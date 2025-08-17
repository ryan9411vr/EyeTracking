/**
 * Left-eye conditional auto-encoder ▸ ENCODER-ONLY
 * Produces an 8-value latent vector:
 * [theta1, theta2, offsetX, offsetY, rotation, unsup1, unsup2, unsup3]
 */

import * as tf from '@tensorflow/tfjs';
import { fileSystemIOHandler } from '../../utilities/fileSystemIOHandler';
import store from '../../store';
import { updateLatentsLeft } from '../../slices/statusSlice';

let encoder: tf.LayersModel | null = null;
const ENCODER_PATH = 'left_autoencoder/model.json'; // relative to modelFolderPath

/** Load left-eye encoder (TF-JS bundle) */
export async function loadModel(modelFolderPath: string): Promise<void> {
  try {
    const url = `${modelFolderPath}\\${ENCODER_PATH}`;
    encoder = await tf.loadLayersModel(fileSystemIOHandler(url));
    console.log('LeftAutoencoder ▸ encoder loaded from', url);
  } catch (err) {
    console.error('LeftAutoencoder ▸ failed to load encoder:', err);
    encoder = null;
  }
}

/**
 * Run the encoder and dispatch the 8-value latent vector to Redux.
 * @returns number[8] or null if encoder missing
 */
export function encodeLatents(left: tf.Tensor3D): number[] | null {
  if (!encoder) {
    // console.warn('LeftAutoencoder ▸ encoder not loaded.');
    return null;
  }

  const latent = tf.tidy(() => {
    const batched = left.expandDims(0);          // 1 × 128 × 128 × 3
    const out     = encoder!.predict(batched) as tf.Tensor; // 1 × 8
    const arr     = Array.from(out.dataSync()) as number[];

    batched.dispose();
    out.dispose();
    return arr;
  });

  /* Dispatch to Redux */
  store.dispatch(
    updateLatentsLeft({
      theta1:        latent[0],
      theta2:        latent[1],
      offsetX:       latent[2],
      offsetY:       latent[3],
      rotation:      latent[4],
      unsupervised1: latent[5],
      unsupervised2: latent[6],
      unsupervised3: latent[7],
      timestamp:     Date.now(),
    })
  );

  return latent;
}