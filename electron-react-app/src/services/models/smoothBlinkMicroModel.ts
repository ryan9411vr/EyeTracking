// src/services/models/smoothBlinkModel.ts
import * as tf from '@tensorflow/tfjs';
import { modelRegistry, withVersion } from './registry';
import type { Eye, Vec3, SampleMatrix, TrainOpts, ModelKey } from './types';

export interface BlinkTrainingData {
  latents: SampleMatrix;
  peaks: number[];
  valleys: number[];
}

const VERSION = 1;

const matrixToTensor = (m: SampleMatrix): tf.Tensor2D =>
  tf.tensor2d(m[0].map((_, i) => [m[0][i], m[1][i], m[2][i]]), [m[0].length, 3]);

const buildModel = () => tf.sequential({
  layers: [
    tf.layers.dense({ units: 16, activation: 'relu', inputShape: [3] }),
    tf.layers.dense({ units: 8, activation: 'relu' }),
    tf.layers.dense({ units: 1, activation: 'sigmoid' }),
  ],
});

const makeCompositeLoss = (
  orderingSign: number[],
  peaks: Set<number>,
  valleys: Set<number>,
) => (yTrue: tf.Tensor, yPred: tf.Tensor) => tf.tidy(() => {
  const y = yPred.squeeze();                    // [N]
  const N = y.shape[0];

  const anchorIdx = [...peaks, ...valleys];
  const yAnchor = tf.gather(y, tf.tensor1d(anchorIdx, 'int32'));
  const target  = tf.tensor1d(anchorIdx.map(i => peaks.has(i) ? 1 : 0));
  const anchorLoss = tf.losses.meanSquaredError(target, yAnchor);

  const yNext = y.slice(1), yCurr = y.slice(0, N - 1);
  const diff = yNext.sub(yCurr);
  const sign = tf.tensor1d(orderingSign);
  const orderingLoss = tf.relu(sign.mul(diff).neg()).mean();

  return anchorLoss.add(orderingLoss.mul(0.5));
});

export const getKey = (eye: Eye, version = VERSION): ModelKey =>
  withVersion('smooth', eye, version);

export async function train(
  eye: Eye,
  data: BlinkTrainingData,
  opts: TrainOpts = {},
) {
  const version = opts.version ?? VERSION;
  const key = getKey(eye, version);

  const xs = matrixToTensor(data.latents);
  const N  = xs.shape[0];
  const ys = tf.zeros([N, 1]);

  // ordering signs
  const orderingSign: number[] = Array(N - 1).fill(0);
  const extrema = [...data.valleys, ...data.peaks].sort((a, b) => a - b);
  if (extrema.length >= 2) {
    let rising = data.valleys.includes(extrema[0]);
    for (let k = 0; k < extrema.length - 1; k++) {
      const s = extrema[k], e = extrema[k + 1], sgn = rising ? 1 : -1;
      for (let i = s; i < e; i++) orderingSign[i] = sgn;
      rising = !rising;
    }
  }

  const model = buildModel();
  model.compile({
    optimizer: tf.train.adam(opts.learningRate ?? 0.001),
    loss: makeCompositeLoss(orderingSign, new Set(data.peaks), new Set(data.valleys)),
  });

  await model.fit(xs, ys, {
    epochs: opts.epochs ?? 100,
    batchSize: N, shuffle: false, verbose: 0,
  });

  tf.dispose([xs, ys]);
  await modelRegistry.set(key, model, /*persist*/ true);
}

export function predict(eye: Eye, v: Vec3, version = VERSION): number {
  const key = getKey(eye, version);
  const model = modelRegistry.get(key);
  if (!model) return NaN; // signal “no smooth model yet”
  const out = model.predict(tf.tensor2d([v], [1, 3])) as tf.Tensor;
  const val = out.dataSync()[0];
  out.dispose();
  return Math.min(Math.max(val, 0), 1);
}
