#!/usr/bin/env python
"""
Retrain Right Eye Openness Model using a pre-existing model for relabeling.

This script loads eye images from an SQLite database, preprocesses and augments them,
and then uses an existing model to relabel the data. A new TensorFlow model is built,
trained on the relabeled data, and saved to the specified output directory.
"""

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
from tensorflow.keras.regularizers import l2

# Global configuration constants.
BATCH_SIZE = 128
IMAGE_SIZE = 128       # Size to resize each eye image (width and height).
MAX_OFFSET = 10        # Maximum pixel offset for on-the-fly augmentation.
DEFAULT_LIMIT = 25000  # Default limit on the number of rows to query from the database.


def data_url_to_image(data_url: str) -> Image.Image:
    """
    Convert a data URL to a PIL Image.

    Parameters:
        data_url (str): The data URL containing the image encoded in base64.

    Returns:
        Image.Image: The decoded PIL Image.
    """
    header, encoded = data_url.split(',', 1)
    data = base64.b64decode(encoded)
    return Image.open(BytesIO(data))


def preprocess_eye(data_url: str, size=(IMAGE_SIZE, IMAGE_SIZE)) -> np.ndarray:
    """
    Decode a data URL into a normalized image array.

    The image is converted to RGB, resized to the given size, and normalized to [0, 1].

    Parameters:
        data_url (str): The data URL of the eye image.
        size (tuple): Desired size (width, height) for the output image.

    Returns:
        np.ndarray: The processed image as a NumPy array.
    """
    try:
        img = data_url_to_image(data_url).convert("RGB").resize(size)
        img.load()  # Force load to trigger potential errors
        return np.array(img) / 255.0
    except Exception as e:
        raise ValueError(f"Error in preprocess_eye: {e}")


def random_offset_image(image: np.ndarray, max_offset: int = MAX_OFFSET) -> np.ndarray:
    """
    Apply a random offset to the image for augmentation.

    The image is shifted randomly along the x and y axes and empty regions are filled with zeros.

    Parameters:
        image (np.ndarray): The input image array.
        max_offset (int): Maximum offset (in pixels) for both x and y directions.

    Returns:
        np.ndarray: The augmented image with random offsets applied.
    """
    h, w, c = image.shape
    offset_x = np.random.randint(-max_offset, max_offset + 1)
    offset_y = np.random.randint(-max_offset, max_offset + 1)

    shifted = np.zeros_like(image)
    # Compute x-axis source and destination indices.
    if offset_x >= 0:
        src_x_start, src_x_end = 0, w - offset_x
        dest_x_start, dest_x_end = offset_x, w
    else:
        src_x_start, src_x_end = -offset_x, w
        dest_x_start, dest_x_end = 0, w + offset_x

    # Compute y-axis source and destination indices.
    if offset_y >= 0:
        src_y_start, src_y_end = 0, h - offset_y
        dest_y_start, dest_y_end = offset_y, h
    else:
        src_y_start, src_y_end = -offset_y, h
        dest_y_start, dest_y_end = 0, h + offset_y

    shifted[dest_y_start:dest_y_end, dest_x_start:dest_x_end, :] = (
        image[src_y_start:src_y_end, src_x_start:src_x_end, :]
    )
    return shifted


def load_data_from_db(db_path: str):
    """
    Load Right eye images and openness labels from the SQLite database.
    Only rows where rightEyeFrame is non-empty and type is 'openness' are used.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT rightEyeFrame, openness
        FROM training_data
        WHERE rightEyeFrame != '' AND type == 'openness'
        ORDER BY RANDOM()
        LIMIT 35000
    """)
    rows = cursor.fetchall()
    conn.close()
    
    images = []
    labels = []
    for right_frame, openness in rows:
        try:
            right_img = preprocess_eye(right_frame, size=(128, 128))
            right_img = random_offset_image(right_img, max_offset=MAX_OFFSET)
        except Exception as e:
            print("Skipping image due to error.")
            continue
        images.append(right_img)
        labels.append([openness])
    
    return np.array(images), np.array(labels)

def build_model() -> tf.keras.Model:
    """
    Build and compile the Right Eye Openness model.

    The model architecture consists of convolutional, pooling, and dense layers,
    and is compiled with the Adam optimizer and mean squared error loss.

    Returns:
        tf.keras.Model: The compiled TensorFlow Keras model.
    """
    model = Sequential([
        InputLayer(input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3)),
        
        Conv2D(32, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),
        
        Conv2D(64, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),
        
        Conv2D(128, (7, 7), activation='relu'),
        MaxPooling2D((3, 3)),
        Flatten(),
        
        Dense(64, activation='relu'),
        Dense(1, name='open-c')
    ])
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model


def main():
    """
    Main function to load data, relabel using an existing model, train a new model, and save it.
    """
    parser = argparse.ArgumentParser(
        description="Retrain Right Eye Openness Model using a pre-existing model for relabeling"
    )
    parser.add_argument("--input_model_path", required=True, help="Path to an existing .h5 model file")
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
    new_model_path = os.path.join(output_dir, "right_openness_gen2.h5")

    # Load training data.
    print("Loading training data from:", db_path)
    images, labels = load_data_from_db(db_path)
    print("Images shape:", images.shape, "Labels shape:", labels.shape)

    # Load the existing model.
    print("Loading existing model from:", input_model_path)
    loaded_model = tf.keras.models.load_model(input_model_path)
    loaded_model.summary()

    # Relabel training data using the loaded model.
    print("Relabeling training data using the loaded model...")
    predictions = loaded_model.predict(images, batch_size=BATCH_SIZE)

    # Compute the 5th and 95th percentiles of the predictions.
    labels_flat = predictions.flatten()
    p5 = np.percentile(labels_flat, 5)
    p95 = np.percentile(labels_flat, 95)

    # Scale the predictions linearly so that the 5th percentile maps to 0 and the 95th to 0.75.
    new_training_labels_scaled = (predictions - p5) / (p95 - p5) * 0.75

    # Clip the scaled labels to be within [0, 0.75].
    new_training_labels_scaled = np.clip(new_training_labels_scaled, 0.0, 0.75)

    # Build and train the new model.
    print("Building and training new model on relabeled data...")
    new_model = build_model()
    new_model.summary()

    lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss', factor=0.5, patience=5, verbose=1, min_lr=1e-6
    )
    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=15, restore_best_weights=True, verbose=1
    )

    new_model.fit(
        images, new_training_labels_scaled,
        epochs=250,
        batch_size=BATCH_SIZE,
        validation_split=0.1,
        callbacks=[lr_scheduler, early_stopping]
    )

    new_model.save(new_model_path)
    print("New model saved to", new_model_path)

if __name__ == '__main__':
    main()
