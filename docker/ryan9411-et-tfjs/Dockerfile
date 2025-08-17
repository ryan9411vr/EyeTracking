# Base: NVIDIA TF with CUDA 12.8 / Blackwell support
FROM nvcr.io/nvidia/tensorflow:25.02-tf2-py3

USER root

# Copy and install Python deps
COPY requirements.txt /tmp/requirements.txt
RUN python3 -m pip install --upgrade pip setuptools wheel && \
    python3 -m pip install --no-cache-dir -r /tmp/requirements.txt

# Copy in model training code
RUN mkdir -p /src/input/
RUN mkdir -p /src/output/
COPY convert_to_tfjs.py /src/convert_to_tfjs.py
