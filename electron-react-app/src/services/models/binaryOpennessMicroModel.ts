// src/services/models/binaryOpennessModel.ts
import * as tf from '@tensorflow/tfjs';
import { modelRegistry, withVersion } from './registry';
import type { Eye, Vec3, SampleMatrix, TrainOpts, ModelKey } from './types';

const VERSION = 1;

const matrixToTensor = (m: SampleMatrix): tf.Tensor2D =>
  tf.tensor2d(m[0].map((_, i) => [m[0][i], m[1][i], m[2][i]]), [m[0].length, 3]);

const buildModel = () => tf.sequential({
  layers: [
    tf.layers.dense({ inputShape: [3], units: 8, activation: 'relu' }),
    tf.layers.dense({ units: 1, activation: 'sigmoid' }),
  ],
});

export const getKey = (eye: Eye, version = VERSION): ModelKey =>
  withVersion('binary', eye, version);

export async function train(
  eye: Eye,
  closed: SampleMatrix,
  open: SampleMatrix,
  opts: TrainOpts = {},
) {
  const version = opts.version ?? VERSION;
  const key = getKey(eye, version);

  // balance classes
  const k = Math.min(closed[0].length, open[0].length);
  const down = (m: SampleMatrix): SampleMatrix => {
    const idx = Array.from(tf.util.createShuffledIndices(m[0].length)).slice(0, k);
    return [idx.map(i => m[0][i]), idx.map(i => m[1][i]), idx.map(i => m[2][i])];
  };
  const c = down(closed), o = down(open);

  const xC = matrixToTensor(c), xO = matrixToTensor(o);
  const yC = tf.fill([k, 1], 0), yO = tf.fill([k, 1], 1);
  const xs = tf.concat([xC, xO], 0);
  const ys = tf.concat([yC, yO], 0);

  const model = buildModel();
  model.compile({ loss: 'meanSquaredError', optimizer: tf.train.adam(opts.learningRate ?? 0.01) });

  await model.fit(xs, ys, { epochs: opts.epochs ?? 100, batchSize: 32, shuffle: true, verbose: 0 });
  tf.dispose([xC, xO, yC, yO, xs, ys]);

  await modelRegistry.set(key, model, /*persist*/ true);
}

export function predict(eye: Eye, v: Vec3, version = VERSION): number {
  const key = getKey(eye, version);
  const model = modelRegistry.get(key);
  if (!model) return 0.5;

  const out = model.predict(tf.tensor2d([v], [1, 3])) as tf.Tensor;
  const val = out.dataSync()[0];
  out.dispose();
  return Math.min(Math.max(val, 0), 1);
}
