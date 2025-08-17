#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Conditional eye-gaze auto-encoder
• Early-stops if val_loss stalls ≥ 15 epochs
• Memory-light pipeline: SQL rows kept in RAM, images decoded per batch
"""
import os
import math
import argparse
import sqlite3
import base64
from io import BytesIO
from typing import List, Tuple

os.environ["TF_GPU_ALLOCATOR"] = "cuda_malloc_async"
# os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras import layers, Model, Input
from tensorflow.keras.utils import Sequence

# ──────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────
BATCH_SIZE    = 64
IMAGE_SIZE    = 128          # each eye 128×128 ➞ concatenated 128×256
MAX_OFFSET    = 10
MAX_ROTATION  = 15
DATASET_LIMIT = 20000        # rows to pull from DB

# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────
def data_url_to_image(data_url: str) -> Image.Image:
    header, encoded = data_url.split(",", 1)
    return Image.open(BytesIO(base64.b64decode(encoded)))


def preprocess_eye(data_url: str, size=(128, 128)) -> np.ndarray:
    img = data_url_to_image(data_url).convert("RGB").resize(size)
    img.load()
    return np.asarray(img, dtype=np.float32) / 255.0


def offset_image(img: np.ndarray, ox: int, oy: int) -> np.ndarray:
    h, w, _ = img.shape
    out = np.zeros_like(img)

    src_x0, src_x1 = max(0, -ox), min(w, w - ox)
    dst_x0, dst_x1 = max(0,  ox), min(w, w + ox)

    src_y0, src_y1 = max(0, -oy), min(h, h - oy)
    dst_y0, dst_y1 = max(0,  oy), min(h, h + oy)

    out[dst_y0:dst_y1, dst_x0:dst_x1] = img[src_y0:src_y1, src_x0:src_x1]
    return out

def rotate_image(img: np.ndarray, angle: float) -> np.ndarray:
    rot = Image.fromarray((img * 255).astype(np.uint8)).rotate(
        angle, resample=Image.BILINEAR, fillcolor=(0, 0, 0)
    )
    return np.asarray(rot, dtype=np.float32) / 255.0

def load_rows_from_db(db_path: str) -> List[Tuple[str, str, float, float]]:
    """Return (leftEyeFrame, rightEyeFrame, theta1, theta2) rows only."""
    sql = f"""
        SELECT leftEyeFrame, rightEyeFrame, theta1, theta2
        FROM training_data
        WHERE leftEyeFrame != '' AND rightEyeFrame != '' AND type = 'gaze'
        ORDER BY RANDOM()
        LIMIT {DATASET_LIMIT}
    """
    print("DB PATH")
    print(db_path)
    with sqlite3.connect(db_path) as conn:
        return conn.execute(sql).fetchall()

# ──────────────────────────────────────────────────────────────────────────────
# DATA GENERATOR
# ──────────────────────────────────────────────────────────────────────────────
class EyeGazeSequence(Sequence):
    """Decodes/augments on-the-fly to keep RAM usage low."""

    def __init__(
        self,
        rows: List[Tuple[str, str, float, float]],
        batch_size: int,
        augment: bool = True,
        shuffle: bool = True,
    ):
        self.rows = rows
        self.batch_size = batch_size
        self.augment = augment
        self.shuffle = shuffle
        self.on_epoch_end()

    def __len__(self) -> int:
        return math.ceil(len(self.rows) / self.batch_size)

    def on_epoch_end(self):
        self.indices = np.arange(len(self.rows))
        if self.shuffle:
            np.random.shuffle(self.indices)

    def __getitem__(self, idx: int):
        batch_idx = self.indices[idx * self.batch_size : (idx + 1) * self.batch_size]

        imgs, lbls = [], []
        for i in batch_idx:
            l_enc, r_enc, theta1, theta2 = self.rows[i]

            # decode & optionally augment
            l_img = preprocess_eye(l_enc)
            r_img = preprocess_eye(r_enc)

            if self.augment:
                ox = np.random.randint(-MAX_OFFSET, MAX_OFFSET + 1)
                oy = np.random.randint(-MAX_OFFSET, MAX_OFFSET + 1)
                ang = np.random.uniform(-MAX_ROTATION, MAX_ROTATION)

                l_img = rotate_image(offset_image(l_img, ox, oy), ang)
                r_img = rotate_image(offset_image(r_img, ox, oy), ang)
            else:
                ox = oy = ang = 0.0

            imgs.append(np.concatenate((l_img, r_img), axis=1))
            lbls.append([theta1, theta2, ox, oy, ang])

        X = np.asarray(imgs, dtype=np.float32)
        Y = np.asarray(lbls, dtype=np.float32)
        dummy = np.zeros((X.shape[0], 3), dtype=np.float32)

        return X, {
            "decoder_model": X,
            "sup_pred": Y,
            "unsup_latent": dummy,
        }

# ──────────────────────────────────────────────────────────────────────────────
# MODEL DEFINITION
# ──────────────────────────────────────────────────────────────────────────────
class DeCorrelation(layers.Layer):
    """
    Penalises linear correlation between two tensors.
    loss = λ * || Cov(A,B) ||_F²    (Frobenius norm)
    """
    def __init__(self, weight=1e-3, **kwargs):
        super().__init__(**kwargs)
        self.weight = weight

    def call(self, inputs):
        a, b = inputs                       # shapes: (batch, d_a) and (batch, d_b)
        a_c = a - tf.reduce_mean(a, axis=0, keepdims=True)
        b_c = b - tf.reduce_mean(b, axis=0, keepdims=True)
        # unbiased covariance estimate
        cov = tf.matmul(a_c, b_c, transpose_a=True) / tf.cast(tf.shape(a)[0], tf.float32)
        self.add_loss(self.weight * tf.reduce_sum(tf.square(cov)))
        return inputs                       # pass–through (output is unused)

# ───────────────────────────────────────────────────────────────────────────
def build_models():
    # ── Encoder trunk ──────────────────────────────────────────────────────
    img_in = Input(shape=(IMAGE_SIZE, 2 * IMAGE_SIZE, 3), name="image_input")

    x = layers.Conv2D(32, 7, padding="same", activation="relu")(img_in)
    x = layers.MaxPooling2D(3, padding="same")(x)
    x = layers.Conv2D(64, 7, padding="same", activation="relu")(x)
    x = layers.MaxPooling2D(3, padding="same")(x)
    x = layers.Conv2D(128, 7, padding="same", activation="relu")(x)
    x = layers.MaxPooling2D(3, padding="same")(x)
    x = layers.Flatten()(x)
    x = layers.Dense(64, activation="relu")(x)

    # ── Separate heads -----------------------------------------------------
    # 5 supervised dimensions (gaze angles) – gradient *blocked*
    sup_pred = layers.Dense(5, name="sup_pred")(x)

    # 3 unsupervised / free dimensions
    unsup_latent = layers.Dense(3, name="unsup_latent")(x)

    # decorrelation penalty (very cheap, batch-level)
    _ = DeCorrelation(weight=1e-3)([sup_pred, unsup_latent])

    # Re-assemble the full 8-D latent vector      (order: 5 sup | 3 unsup)
    latent_vec = layers.Concatenate(name="latent_concat")([sup_pred, unsup_latent])

    # ── Decoder ────────────────────────────────────────────────────────────
    dec_in = Input(shape=(8,), name="decoder_input")
    d = layers.Dense(128 * 32 * 64, activation="relu")(dec_in)
    d = layers.Reshape((32, 64, 128))(d)

    for _ in range(2):
        d = layers.Conv2D(128, 3, padding="same", activation="relu")(d)
        d = layers.BatchNormalization()(d)
        d = layers.Conv2DTranspose(64, 3, strides=2, padding="same", activation="relu")(d)
        d = layers.BatchNormalization()(d)

    recon_out = layers.Conv2D(
        3, 3, padding="same", activation="sigmoid", name="reconstruction")(d)

    decoder = Model(dec_in, recon_out, name="decoder_model")

    # Full auto-encoder graph
    recon = decoder(latent_vec)
    auto  = Model(img_in, [recon, sup_pred, unsup_latent],
                  name="conditional_autoencoder")

    # Stand-alone encoder that outputs the whole 8-D code
    encoder = Model(img_in, latent_vec, name="encoder_model")

    return auto, encoder, decoder

# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Train conditional auto-encoder")
    ap.add_argument("--db_path", required=True, help="SQLite DB with training data")
    ap.add_argument("--output_dir", required=True, help="Directory to save models")
    args = ap.parse_args()

    # ── Data ----------------------------------------------------------------
    print("Fetching rows from database …")
    rows = load_rows_from_db(args.db_path)
    train_rows, val_rows = train_test_split(rows, test_size=0.1, random_state=42)
    train_gen = EyeGazeSequence(train_rows, BATCH_SIZE, augment=True, shuffle=True)
    val_gen = EyeGazeSequence(val_rows, BATCH_SIZE, augment=False, shuffle=False)

    # ── Model ---------------------------------------------------------------
    auto, enc, dec = build_models()
    auto.compile(
        optimizer="adam",
        loss={
            "decoder_model": "mse",
            "sup_pred": "mse",
            "unsup_latent": "mse",
        },
        loss_weights={
            "decoder_model": 1.0,
            "sup_pred": 1.0,
            "unsup_latent": 0.0,  # unsupervised part not trained
        },
    )

    # ── Training ------------------------------------------------------------
    early_stop = tf.keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=15, restore_best_weights=True, verbose=1
    )

    auto.fit(
        train_gen,
        validation_data=val_gen,
        epochs=200,
        callbacks=[early_stop],
    )

    # ── Save ---------------------------------------------------------------
    os.makedirs(args.output_dir, exist_ok=True)
    enc.save(os.path.join(args.output_dir, "encoder.h5"))
    dec.save(os.path.join(args.output_dir, "decoder.h5"))
    print("Saved encoder & decoder to", args.output_dir)

if __name__ == "__main__":
    main()
