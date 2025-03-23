#!/usr/bin/env python
import os
import re
import argparse
import sqlite3
import base64
from io import BytesIO
import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras import Sequential
from tensorflow.keras.layers import InputLayer, Conv2D, MaxPooling2D, Flatten, Dense, Dropout

# Global configuration constants.
BATCH_SIZE = 32
IMAGE_SIZE = (128, 128)      # Size to resize each eye image.
MAX_OFFSET = 10              # Maximum pixel offset for on-the-fly augmentation.
DEFAULT_LIMIT = 25000        # Default limit on the number of rows to query from the database.

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

def load_combined_data_from_db(db_path: str):
    """
    Load combined eye images and openness labels from the SQLite database.
    
    Only rows where both leftEyeFrame and rightEyeFrame are non-empty are used.
    The combined image is created by concatenating the left and right images side-by-side.
    The label is a continuous value: openness.
    Augmentation (random offset) is applied to each eye image.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
        #AND openness NOT IN (0, 0.75)
    cursor.execute(f"""
        SELECT leftEyeFrame, rightEyeFrame, openness
        FROM training_data
        WHERE leftEyeFrame != ''
        AND rightEyeFrame != ''
        AND type == 'openness'
        ORDER BY RANDOM()
        LIMIT {DEFAULT_LIMIT}
    """)
    rows = cursor.fetchall()
    conn.close()
    
    combined_images = []
    labels = []
    right_images = []
    for left_frame, right_frame, openness in rows:
        try:
            left_img = preprocess_eye(left_frame, size=IMAGE_SIZE)
            right_img = preprocess_eye(right_frame, size=IMAGE_SIZE)
            # Apply random offset augmentation to both images.
            left_img = random_offset_image(left_img, max_offset=MAX_OFFSET)
            right_img = random_offset_image(right_img, max_offset=MAX_OFFSET)
        except Exception as e:
            print("Skipping image due to error.")
            continue
        # Concatenate images along width (axis=1)
        combined_img = np.concatenate([left_img, right_img], axis=1)
        combined_images.append(combined_img)
        labels.append([openness])
        right_images.append(right_img)
    
    return np.array(combined_images), np.array(labels), np.array(right_images)

def build_model():
    """
    Build and compile the Right Eye Openness model.
    This architecture matches train_right_openness.py.
    """
    model = Sequential([
        InputLayer(input_shape=(128, 128, 3)),
        
        Conv2D(16, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),
        
        Conv2D(32, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),
        
        Conv2D(64, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),
        Flatten(),
        
        Dropout(0.2),
        Dense(64, activation='relu'),
        Dense(1, name='open-c')
    ])
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model

def main():
    parser = argparse.ArgumentParser(
        description="Train Right Eye Openness Model using combined eye model as a labeler"
    )
    parser.add_argument("--input_model_path", required=True, help="Path to an existing .h5 right openness model")
    parser.add_argument("--db_path", required=True, help="Path to the SQLite database file")
    parser.add_argument("--output_dir", required=True, help="Directory where output files will be saved")
    args = parser.parse_args()
    
    input_model_path = args.input_model_path
    db_path = args.db_path
    output_dir = args.output_dir

    if not os.path.isfile(input_model_path):
        print("Model file not found. Exiting.")
        return
    if not os.path.isfile(db_path):
        print("Database file not found. Exiting.")
        return
    if not os.path.isdir(output_dir):
        print("Output directory not found. Exiting.")
        return
    
    # Determine the output path for the new model.
    new_model_path = os.path.join(output_dir, "right_openness_distilled.h5")
    
    # Load training data.
    print("Loading training data from:", db_path)
    images, labels, right_images = load_combined_data_from_db(db_path)
    print("Images shape:", images.shape, "Labels shape:", labels.shape)
    
    # Load the existing model.
    print("Loading existing model from:", input_model_path)
    loaded_model = tf.keras.models.load_model(input_model_path)
    loaded_model.summary()
    
    # Relabel training data using the loaded model.
    print("Relabeling training data using the loaded model...")
    predictions = loaded_model.predict(images, batch_size=BATCH_SIZE)

    # Compute the 5th and 95th percentiles of new_training_labels.
    # Since new_training_labels has shape (num_samples, 1), flatten it for percentile calculation.
    labels_flat = predictions.flatten()
    p5 = np.percentile(labels_flat, 5)
    p95 = np.percentile(labels_flat, 95)

    # Scale the labels linearly so that the 5th percentile maps to 0 and the 95th to 0.75.
    new_training_labels_scaled = (predictions - p5) / (p95 - p5) * 0.75

    # Clip the scaled labels so that values below 0 and above 0.75 are capped.
    new_training_labels_scaled = np.clip(new_training_labels_scaled, 0.0, 0.75)

    # Build a new model.
    print("Building and training new left eye model on relabeled data...")
    new_model = build_model()
    new_model.summary()
    
    lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss', factor=0.5, patience=5, verbose=1, min_lr=1e-6
    )
    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=15, restore_best_weights=True, verbose=1
    )
    
    # Train the new model using training data sorted by predictions of the
    # combined eye model.
    new_model.fit(
        right_images, new_training_labels_scaled,
        epochs=250,
        batch_size=32,
        validation_split=0.1,
        callbacks=[lr_scheduler, early_stopping]
    )
    
    new_model.save(new_model_path)
    print("New right eye model saved to", new_model_path)

if __name__ == '__main__':
    main()
