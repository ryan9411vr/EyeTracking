#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
TensorFlow → TensorFlow-JS converter UI for the new auto-encoder models.

Available .h5 files (all are optional; convert only what you need):

    encoder.h5          - combined encoder  (left + right concatenated)
    decoder.h5          - combined decoder
    encoder_left.h5     - left-eye encoder
    decoder_left.h5     - left-eye decoder
    encoder_right.h5    - right-eye encoder
    decoder_right.h5    - right-eye decoder
"""
import os
import sys
import types
import tkinter as tk
from tkinter import filedialog, messagebox

# ──────────────────────────────────────────────────────────────────────────────
#  Guard against missing TF-DF (converter indirectly imports it in some setups)
# ──────────────────────────────────────────────────────────────────────────────
if "tensorflow_decision_forests" not in sys.modules:
    dummy = types.ModuleType("tensorflow_decision_forests")
    dummy.__version__ = "0.0.0"
    sys.modules["tensorflow_decision_forests"] = dummy

import tensorflow as tf
import tensorflowjs as tfjs

# ──────────────────────────────────────────────────────────────────────────────
#  Conversion matrix
# ──────────────────────────────────────────────────────────────────────────────
conversion_groups = [
    {
        "group_label": "Combined Auto-encoder",
        "output_folder": "combined_autoencoder",
        "options": [
            ("None", None),
            ("Encoder (encoder.h5)", "encoder.h5"),
            ("Decoder (decoder.h5)", "decoder.h5"),
        ],
        "default": "None",
    },
    {
        "group_label": "Left-eye Auto-encoder",
        "output_folder": "left_autoencoder",
        "options": [
            ("None", None),
            ("Encoder (encoder_left.h5)", "encoder_left.h5"),
            ("Decoder (decoder_left.h5)", "decoder_left.h5"),
        ],
        "default": "None",
    },
    {
        "group_label": "Right-eye Auto-encoder",
        "output_folder": "right_autoencoder",
        "options": [
            ("None", None),
            ("Encoder (encoder_right.h5)", "encoder_right.h5"),
            ("Decoder (decoder_right.h5)", "decoder_right.h5"),
        ],
        "default": "None",
    },
]

# ──────────────────────────────────────────────────────────────────────────────
#  Globals
# ──────────────────────────────────────────────────────────────────────────────
input_folder = ""
output_folder = ""

# ──────────────────────────────────────────────────────────────────────────────
#  Folder selection helpers
# ──────────────────────────────────────────────────────────────────────────────
def choose_input():
    global input_folder
    p = filedialog.askdirectory(title="Select folder containing .h5 models")
    if p:
        input_folder = p
        in_lbl.config(text=p)


def choose_output():
    global output_folder
    p = filedialog.askdirectory(title="Select output folder for TF-JS models")
    if p:
        output_folder = p
        out_lbl.config(text=p)


# ──────────────────────────────────────────────────────────────────────────────
#  Conversion routine
# ──────────────────────────────────────────────────────────────────────────────
def convert():
    if not input_folder:
        messagebox.showerror("Missing input", "Select the folder with .h5 files first.")
        return
    if not output_folder:
        messagebox.showerror("Missing output", "Select the output folder first.")
        return

    results: list[str] = []

    for group in conversion_groups:
        selection = radio_vars[group["group_label"]].get()
        file_chosen = next(
            fname for (text, fname) in group["options"] if text == selection
        )
        if file_chosen is None:
            results.append(f"Skipped {group['group_label']}")
            continue

        src = os.path.join(input_folder, file_chosen)
        if not os.path.isfile(src):
            results.append(f"⚠ {file_chosen} not found for {group['group_label']}")
            continue

        dst_dir = os.path.join(output_folder, group["output_folder"])
        os.makedirs(dst_dir, exist_ok=True)

        try:
            model = tf.keras.models.load_model(src)
        except Exception as e:
            results.append(f"✖ Load error {file_chosen}: {e}")
            continue

        try:
            tfjs.converters.save_keras_model(model, dst_dir)
            results.append(f"✔ Converted {file_chosen} → {group['output_folder']}")
        except Exception as e:
            results.append(f"✖ Convert error {file_chosen}: {e}")

    messagebox.showinfo("Conversion results", "\n".join(results))


# ──────────────────────────────────────────────────────────────────────────────
#  Build UI
# ──────────────────────────────────────────────────────────────────────────────
root = tk.Tk()
root.title("TF-JS Converter – Auto-encoders")

# I/O frame
io = tk.LabelFrame(root, text="Folders", padx=10, pady=10)
io.pack(fill="both", expand=True, padx=10, pady=5)

tk.Button(io, text="Input folder (.h5)", command=choose_input).grid(
    row=0, column=0, sticky="w", padx=5, pady=5
)
in_lbl = tk.Label(io, text="—")
in_lbl.grid(row=0, column=1, sticky="w")

tk.Button(io, text="Output folder (TF-JS)", command=choose_output).grid(
    row=1, column=0, sticky="w", padx=5, pady=5
)
out_lbl = tk.Label(io, text="—")
out_lbl.grid(row=1, column=1, sticky="w")

# Options frame
opts = tk.LabelFrame(root, text="Select model to convert for each group", padx=10, pady=10)
opts.pack(fill="both", expand=True, padx=10, pady=5)

radio_vars: dict[str, tk.StringVar] = {}

for grp in conversion_groups:
    f = tk.Frame(opts)
    f.pack(fill="x", anchor="w", pady=4)
    tk.Label(f, text=f"{grp['group_label']}:").pack(side="left")

    var = tk.StringVar(value=grp["default"])
    radio_vars[grp["group_label"]] = var

    for text, _ in grp["options"]:
        tk.Radiobutton(f, text=text, variable=var, value=text).pack(side="left", padx=4)

# Convert button
tk.Button(root, text="Convert", command=convert, bg="lightgreen").pack(pady=10)

root.mainloop()
