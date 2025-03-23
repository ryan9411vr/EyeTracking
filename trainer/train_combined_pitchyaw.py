#!/usr/bin/env python
import os
# Set the variable before importing TensorFlow
os.environ["TF_GPU_ALLOCATOR"] = "cuda_malloc_async"

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

MAX_OFFSET = 10              # Maximum pixel offset for on-the-fly augmentation.

def data_url_to_image(data_url: str):
    header, encoded = data_url.split(',', 1)
    data = base64.b64decode(encoded)
    return Image.open(BytesIO(data))

def preprocess_eye(data_url: str, size=(128, 128)):
    """Decode a data URL into an image array."""
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

def load_data_from_db(db_path: str):
    """Load combined eye images and labels from the SQLite database.
    
    Only rows where both leftEyeFrame and rightEyeFrame are non-empty are used.
    The combined image is created by concatenating the left and right images side-by-side.
    The label is a 2-element vector: [theta1, theta2].
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT leftEyeFrame, rightEyeFrame, theta1, theta2
        FROM training_data
        WHERE leftEyeFrame != '' AND rightEyeFrame != '' AND type == 'gaze'
        ORDER BY RANDOM()
        LIMIT 25000
    """)
    rows = cursor.fetchall()
    conn.close()
    
    combined_images = []
    labels = []
    
    for left_frame, right_frame, theta1, theta2 in rows:
        try:
            left_img = preprocess_eye(left_frame, size=(128, 128))
            right_img = preprocess_eye(right_frame, size=(128, 128))
            # Apply random offset augmentation to both images.
            left_img = random_offset_image(left_img, max_offset=MAX_OFFSET)
            right_img = random_offset_image(right_img, max_offset=MAX_OFFSET)
        except Exception as e:
            print("Skipping image due to error.")
            continue
        # Concatenate images along width (axis=1)
        combined_img = np.concatenate([left_img, right_img], axis=1)
        combined_images.append(combined_img)
        labels.append([theta1, theta2])
    
    return np.array(combined_images), np.array(labels)

def main():
    parser = argparse.ArgumentParser(description="Train Combined Pitch/Yaw Model from SQLite DB")
    parser.add_argument("--db_path", required=True, help="Path to the SQLite database file")
    parser.add_argument("--output_dir", required=True, help="Folder to save the trained model")
    args = parser.parse_args()
    
    print("Loading data from:", args.db_path)
    images, labels = load_data_from_db(args.db_path)
    print("Images shape:", images.shape, "Labels shape:", labels.shape)
    
    X_train, X_test, y_train, y_test = train_test_split(
        images, labels, test_size=0.2, random_state=42
    )
    
    # Build the Combined Eye Pitch/Yaw model using Sequential API
    model = Sequential([
        InputLayer(input_shape=(128, 256, 3)),

        Conv2D(32, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),

        Conv2D(64, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),

        Conv2D(128, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),
        Flatten(),

        Dense(64, activation='relu'),
        Dense(2, name='gaze-c')
    ])
    
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    model.summary()
    
    # Callbacks
    lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss', factor=0.5, patience=6, verbose=1, min_lr=1e-6
    )
    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=15, restore_best_weights=True, verbose=1
    )
    
    history = model.fit(
        X_train, y_train,
        epochs=200,
        batch_size=64,
        validation_split=0.1,
        callbacks=[lr_scheduler, early_stopping]
    )
    
    results = model.evaluate(X_test, y_test)
    print("Test loss and MAE:", results)
    
    os.makedirs(args.output_dir, exist_ok=True)
    model_save_path = os.path.join(args.output_dir, "combined_pitchyaw.h5")
    model.save(model_save_path)
    print("Model saved to", model_save_path)

if __name__ == '__main__':
    main()
