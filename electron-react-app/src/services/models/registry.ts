// src/services/models/registry.ts
import * as tf from '@tensorflow/tfjs';
import type { ModelKey } from './types';

const DEFAULT_VERSION = 1;

// Storage helper: turn a key into a persistent URI.

// We can't save the tensorflow micro models in redux (too complex).
// This lets us persist that. This is an exception to the norm, 99% of
// stateful data needs to be in redux.
const uriFor = (key: ModelKey) => `indexeddb://${key}`;

class Registry {
  private map = new Map<ModelKey, tf.LayersModel>();

  has(key: ModelKey) { return this.map.has(key); }
  get(key: ModelKey) { return this.map.get(key) ?? null; }

  async set(key: ModelKey, model: tf.LayersModel, persist = true) {
    const old = this.map.get(key);
    if (old && old !== model) old.dispose();
    this.map.set(key, model);
    if (persist) await model.save(uriFor(key));
  }

  async loadIfExists(key: ModelKey) {
    if (this.map.has(key)) return this.map.get(key)!;
    try {
      const m = await tf.loadLayersModel(uriFor(key));
      this.map.set(key, m);
      return m;
    } catch {
      return null; // not found
    }
  }

  async save(key: ModelKey) {
    const m = this.map.get(key);
    if (m) await m.save(uriFor(key));
  }

  dispose(key: ModelKey) {
    const m = this.map.get(key);
    if (m) { m.dispose(); this.map.delete(key); }
  }
}

export const modelRegistry = new Registry();
export const withVersion = (kind: 'binary' | 'smooth', eye: string, v = DEFAULT_VERSION) =>
  `${kind}:${eye}:v${v}` as ModelKey;
