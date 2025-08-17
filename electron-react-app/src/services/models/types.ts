// src/services/models/types.ts
export type Eye = 'combined' | 'left' | 'right';
export type Vec3 = [number, number, number];
export type SampleMatrix = [number[], number[], number[]];

export type ModelKind = 'binary' | 'smooth';
export type ModelKey = `${ModelKind}:${Eye}:v${number}`;

export interface TrainOpts {
  epochs?: number;
  learningRate?: number;
  version?: number; // bump when topology/loss changes
}
