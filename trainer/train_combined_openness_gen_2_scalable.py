#!/usr/bin/env python
import os
import argparse
import sqlite3
import base64
from io import BytesIO
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras import Sequential
from tensorflow.keras.layers import InputLayer, Conv2D, MaxPooling2D, Flatten, Dense

# Global configuration constants.
BATCH_SIZE = 128
IMAGE_SIZE = (128, 128)      # Size to resize each eye image.
MAX_OFFSET = 10              # Maximum pixel offset for on-the-fly augmentation.
DEFAULT_LIMIT = 250000        # Default limit on the number of rows to query from the database.

def data_url_to_image(data_url: str):
    header, encoded = data_url.split(',', 1)
    data = base64.b64decode(encoded)
    return Image.open(BytesIO(data))

def preprocess_eye(data_url: str, size=(128, 128)):
    """Decode a data URL into an image array."""
    # Wrap the image conversion in a try/except block to catch errors
    try:
        img = data_url_to_image(data_url).convert("RGB").resize(size)
        img.load()  # Force load to trigger potential errors
        return np.array(img) / 255.0
    except Exception as e:
        raise ValueError(f"Error in preprocess_eye: {e}")

def random_offset_image(image, max_offset=MAX_OFFSET):
    """
    Generate an augmented version of the image by randomly offsetting it in the x and y axes.
    Empty regions are filled with zeros.
    """
    h, w, c = image.shape
    offset_x = np.random.randint(-max_offset, max_offset + 1)
    offset_y = np.random.randint(-max_offset, max_offset + 1)
    
    shifted = np.zeros_like(image)
    # For x axis.
    if offset_x >= 0:
        src_x_start, src_x_end = 0, w - offset_x
        dest_x_start, dest_x_end = offset_x, w
    else:
        src_x_start, src_x_end = -offset_x, w
        dest_x_start, dest_x_end = 0, w + offset_x

    # For y axis.
    if offset_y >= 0:
        src_y_start, src_y_end = 0, h - offset_y
        dest_y_start, dest_y_end = offset_y, h
    else:
        src_y_start, src_y_end = -offset_y, h
        dest_y_start, dest_y_end = 0, h + offset_y
    
    shifted[dest_y_start:dest_y_end, dest_x_start:dest_x_end, :] = \
        image[src_y_start:src_y_end, src_x_start:src_x_end, :]
    
    return shifted

def key_exists(db_path: str, key: int) -> bool:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    query = "SELECT 1 FROM training_data WHERE rowid = ? LIMIT 1"
    cursor.execute(query, (key,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

def data_generator_gen2(db_path: str, gen2rows, gen2labels, batch_size: int = BATCH_SIZE, augmentation: bool = True, max_offset: int = MAX_OFFSET):
    total = len(gen2rows)
    start = 0
    while start < total:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        current_batch = gen2rows[start:start+batch_size]
        batch_target_labels = gen2labels[start:start+batch_size]
        placeholders = ','.join('?' for _ in current_batch)
        query = f"""
            SELECT rowid, leftEyeFrame, rightEyeFrame
            FROM training_data
            WHERE rowid IN ({placeholders})
        """
        current_batch_as_py_ints = [int(x) for x in current_batch]
        cursor.execute(query, current_batch_as_py_ints)
        rows = cursor.fetchall()
        conn.close()  # Close connection after fetching data.

        rowid_to_frames = {row[0]: (row[1], row[2]) for row in rows}
        batch_images = []
        for rid in current_batch:
            left_frame, right_frame = rowid_to_frames[rid]
            try:
                left_img = preprocess_eye(left_frame, size=IMAGE_SIZE)
                right_img = preprocess_eye(right_frame, size=IMAGE_SIZE)
                if augmentation:
                    left_img = random_offset_image(left_img, max_offset=max_offset)
                    right_img = random_offset_image(right_img, max_offset=max_offset)
            except Exception as e:
                print("Skipping image due to error.")
                batch_size -= 1
                continue
            combined_img = np.concatenate([left_img, right_img], axis=1)
            batch_images.append(combined_img)
        yield np.array(batch_images), np.array(batch_target_labels)
        start += batch_size

def get_rowids_and_labels(db_path: str, limit: int = DEFAULT_LIMIT):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # Add this to exclude full open and full close 
    # AND openness NOT IN (0, 0.75)
    query = """
        SELECT rowid, openness
        FROM training_data
        WHERE leftEyeFrame != '' 
        AND rightEyeFrame != '' 
        AND type == 'openness'
        ORDER BY RANDOM()
    """
    if limit:
        query += f" LIMIT {limit}"
    cursor.execute(query)
    results = cursor.fetchall()
    conn.close()
    
    rowids = [row[0] for row in results]
    labels = [row[1] for row in results]
    return rowids, labels

def load_existing_model(input_model_path: str):
    model = tf.keras.models.load_model(input_model_path)
    model.summary()
    return model

def batch_predict_from_db(model, db_path: str, rowids, batch_size: int = BATCH_SIZE):
    predictions = []
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    for i in range(0, len(rowids), batch_size):
        batch_ids = rowids[i: i + batch_size]
        placeholders = ','.join('?' for _ in batch_ids)
        query = f"""
            SELECT rowid, leftEyeFrame, rightEyeFrame
            FROM training_data
            WHERE rowid IN ({placeholders})
        """
        cursor.execute(query, batch_ids)
        rows = cursor.fetchall()
        
        rowid_to_frames = {row[0]: (row[1], row[2]) for row in rows}
        batch_images = []
        for rid in batch_ids:
            left_frame, right_frame = rowid_to_frames[rid]
            left_img = preprocess_eye(left_frame, size=IMAGE_SIZE)
            right_img = preprocess_eye(right_frame, size=IMAGE_SIZE)
            combined_img = np.concatenate([left_img, right_img], axis=1)
            batch_images.append(combined_img)
        
        batch_images = np.array(batch_images)
        batch_preds = model.predict(batch_images, batch_size=len(batch_images))
        predictions.extend(batch_preds.tolist())
        
        print(f"Processed batch {i//batch_size + 1} of {((len(rowids)-1)//batch_size)+1}")
    
    conn.close()
    return predictions

def build_model():
    model = Sequential([
        InputLayer(input_shape=(128, 256, 3)),
        Conv2D(32, (3, 3), activation='relu'),
        MaxPooling2D((2, 2)),
        Conv2D(64, (3, 3), activation='relu'),
        MaxPooling2D((2, 2)),
        Conv2D(128, (3, 3), activation='relu'),
        MaxPooling2D((2, 2)),
        Flatten(),
        Dense(64, activation='relu'),
        Dense(1, name='open-c')
    ])
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model

def run_pipeline(input_model_path: str, db_path: str, limit: int = DEFAULT_LIMIT):
    print("Loading model...")
    model = load_existing_model(input_model_path)
    
    print("Building index of row IDs and labels...")
    rowids, labels = get_rowids_and_labels(db_path, limit=limit)
    print(f"Retrieved {len(rowids)} rows from the database.")
    
    print("Generating predictions in batches...")
    predictions = batch_predict_from_db(model, db_path, rowids, batch_size=BATCH_SIZE)
    
    return rowids, labels, predictions

# ----- Top-level generator wrapper defined outside main -----
# This avoids using a lambda and ensures TensorFlow can serialize the function.
def my_data_generator():
    # The variables global_db_path, global_gen2rows, and global_gen2labels
    # are set in main before training begins.
    return data_generator_gen2(global_db_path, global_gen2rows, global_gen2labels, batch_size=BATCH_SIZE, augmentation=True)

def main():
    global global_db_path, global_gen2rows, global_gen2labels  # Declare globals for use in my_data_generator
    parser = argparse.ArgumentParser(
        description="Scalable pipeline for generating predictions from enormous SQL databases."
    )
    parser.add_argument("--input_model_path", required=True, help="Path to an existing .h5 model file")
    parser.add_argument("--db_path", required=True, help="Path to the SQLite database file")
    parser.add_argument("--output_dir", required=True, help="Directory where output files will be saved")
    args = parser.parse_args()
    
    if not os.path.isfile(args.input_model_path):
        print("Model file not found. Exiting.")
        return
    if not os.path.isfile(args.db_path):
        print("Database file not found. Exiting.")
        return
    if not os.path.isdir(args.output_dir):
        print("Output directory not found. Exiting.")
        return

    # Run the pipeline.
    rowids, labels, predictions = run_pipeline(args.input_model_path, args.db_path)
    
    print("Finished processing.")
    print("Sample row IDs:", rowids[:5])
    print("Sample labels:", labels[:5])
    print("Sample predictions:", predictions[:5])

    # Post-processing: Sorting and Shuffling.
    rowids_by_labels = rowids.copy()
    rowids_by_predictions = rowids.copy()
    
    sorted_labels_zip = sorted(zip(labels, rowids_by_labels), key=lambda x: x[0], reverse=True)
    sorted_labels, sorted_rowids_by_labels = zip(*sorted_labels_zip)
    
    sorted_predictions_zip = sorted(zip(predictions, rowids_by_predictions), key=lambda x: x[0], reverse=True)
    sorted_predictions, sorted_rowids_by_predictions = zip(*sorted_predictions_zip)
    
    gen2rows = np.array(sorted_rowids_by_predictions)
    gen2labels = np.array(sorted_labels)
    
    perm = np.random.permutation(len(gen2rows))
    gen2rows = gen2rows[perm]
    gen2labels = gen2labels[perm]
    
    print("Sample gen2rows:", gen2rows[:5])
    print("Sample gen2labels:", gen2labels[:5])

    print("Building and training new model on relabeled data...")
    new_model = build_model()
    new_model.summary()
    
    lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(
        monitor='loss', factor=0.5, patience=5, verbose=1, min_lr=1e-6
    )
    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor='loss', patience=15, restore_best_weights=True, verbose=1
    )
    
    # Set global variables for the generator wrapper.
    global_db_path = args.db_path
    global_gen2rows = gen2rows
    global_gen2labels = gen2labels

    steps_per_epoch = int(np.ceil(len(gen2rows) / BATCH_SIZE))
    dataset = tf.data.Dataset.from_generator(
        my_data_generator,
        output_types=(tf.float32, tf.float32)
    )
    dataset = dataset.repeat()  # Repeat the dataset indefinitely.

    new_model.fit(
        dataset,
        epochs=250,
        steps_per_epoch=steps_per_epoch,
        callbacks=[lr_scheduler, early_stopping]
    )
    
    new_model_path = os.path.join(args.output_dir, "combined_openness_gen2.h5")
    new_model.save(new_model_path)
    print("New model saved to", new_model_path)

if __name__ == '__main__':
    main()
