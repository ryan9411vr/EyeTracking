// src/services/opennessComputationService.ts
// ------------------------------------------------------------
// Full pipeline:
//   • Step 1/2  — collect closed / open clips → train binary model
//   • Step 3/4  — collect slow-blink clip → label peaks/valleys
//   • Step 5    — train smooth-blink model with ordering loss
//   • Step 6    — use smooth-blink model for real-time openness

/**
 * In more human language, the autoencoder outputs 5 known values
 * (pitch/yaw/rotation/offsetX/offsetY). It has 3 left over values where
 * the blinking resides. Unfortunately extracting meaning from those 3
 * values isn't straightforward. So in order to pull meaning from those 3
 * magic numbers, the solution? Throw more AI at the problem.
 * 
 * So ask the user to record a short clip of them with their eyes open and
 * eyes closed. This lets us train a super small model that just says one
 * thing. Open or Closed. Then we ask the user to blink for slowly and use
 * the "open or closed" model on that data. That output data is then smoothed
 * out a bit and then processed to determine the peaks (open eyes) and valleys
 * (closed eyes) of the sequence of data.
 * 
 * Then we train a second model. This one is unique in that the loss function
 * punishes the model for putting things out of order. To explain: in theory
 * the eye should only be getting wider from closed -> open. It shouldn't be
 * say "10%, 15%, 20%, 25%, 10%, 30%" and so on. By encouraging it to train
 * the data "in order" it gives a smoother blink output without as much 
 * jitter.
 * 
 * This file does a lot of data-wrangling from collecting the data to 
 * calling the model trainers to persisting that data and acting as the
 * director of what model gets called when the tracking part of the client
 * needs to compute openness for an eye. Just think this:
 * 
 * Collect data for Model 1 -> Train Model 1 -> 
 * Collect data for Model 2 -> Train Model 2 ->
 * Good tracking.
 */
// ------------------------------------------------------------

import { Eye } from './models/types';
import { train as trainBinary, predict as predictBinary, getKey as binKey } from './models/binaryOpennessMicroModel';
import { train as trainSmooth, predict as predictSmooth, BlinkTrainingData, getKey as smoothKey } from './models/smoothBlinkMicroModel';
import { modelRegistry } from './models/registry';
import {
  setCalibrationPlotCombined,
  setCalibrationPlotLeft,
  setCalibrationPlotRight,
  setBlinkOpenThreshold,
  setBlinkCloseThreshold,
} from '../slices/configSlice';
import store, { RootState } from '../store';

const OPEN_TH_FIXED = 0.8;
const CLOSE_TH_FIXED = 0.2;

/* ──────────────────────────── Types ─── */

type Vec3 = [number, number, number];
export type SampleMatrix = [number[], number[], number[]];

/* ───────────────────────── Buffers ─── */

interface CalibrationBuffer {
  combined: SampleMatrix | null;
  left: SampleMatrix | null;
  right: SampleMatrix | null;
  lastCombinedTS: number | null;
  lastLeftTS: number | null;
  lastRightTS: number | null;
  ongoing: boolean;
}

const makeBuffer = (): CalibrationBuffer => ({
  combined: null,
  left: null,
  right: null,
  lastCombinedTS: null,
  lastLeftTS: null,
  lastRightTS: null,
  ongoing: false,
});

const closedBuffer = makeBuffer();
const openBuffer = makeBuffer();
const blinkBuffer = makeBuffer();

/* ───────────────────────── Helpers (buffers) ─── */

const ensureMatrices = (b: CalibrationBuffer) => {
  if (!b.combined) b.combined = [[], [], []];
  if (!b.left) b.left = [[], [], []];
  if (!b.right) b.right = [[], [], []];
};

const appendSamples = (
  buffer: CalibrationBuffer,
  combinedTS: number | null,
  leftTS: number | null,
  rightTS: number | null,
  latents: { unsupervised1: number; unsupervised2: number; unsupervised3: number },
  latentsLeft: { unsupervised1: number; unsupervised2: number; unsupervised3: number },
  latentsRight: { unsupervised1: number; unsupervised2: number; unsupervised3: number },
) => {
  ensureMatrices(buffer);

  if (combinedTS !== null && combinedTS !== buffer.lastCombinedTS) {
    buffer.combined![0].push(latents.unsupervised1);
    buffer.combined![1].push(latents.unsupervised2);
    buffer.combined![2].push(latents.unsupervised3);
    buffer.lastCombinedTS = combinedTS;
  }

  if (leftTS !== null && leftTS !== buffer.lastLeftTS) {
    buffer.left![0].push(latentsLeft.unsupervised1);
    buffer.left![1].push(latentsLeft.unsupervised2);
    buffer.left![2].push(latentsLeft.unsupervised3);
    buffer.lastLeftTS = leftTS;
  }

  if (rightTS !== null && rightTS !== buffer.lastRightTS) {
    buffer.right![0].push(latentsRight.unsupervised1);
    buffer.right![1].push(latentsRight.unsupervised2);
    buffer.right![2].push(latentsRight.unsupervised3);
    buffer.lastRightTS = rightTS;
  }
};

const resetBuffer = (b: CalibrationBuffer) => {
  b.combined = b.left = b.right = null;
  b.lastCombinedTS = b.lastLeftTS = b.lastRightTS = null;
};

/* ───────────────────────── Helpers (generic) ─── */

const matToFrames = (m: SampleMatrix): Vec3[] =>
  m[0].map((_, i) => [m[0][i], m[1][i], m[2][i]] as Vec3);

// Median → zero-phase EMA (forward + backward, then average).
function smoothSeries(pred: number[], medWin = 5, alpha = 0.35): number[] {
  if (!pred.length) return [];

  // --- short median to kill spikes ---
  const med: number[] = pred.map((_, i) => {
    const s = Math.max(0, i - (medWin >> 1));
    const e = Math.min(pred.length, i + (medWin >> 1) + 1);
    const w = pred.slice(s, e).slice().sort((a, b) => a - b);
    const m = w.length >> 1;
    return w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2;
  });

  // --- causal EMA (forward) ---
  const fwd: number[] = new Array(med.length);
  let acc = med[0];
  fwd[0] = acc;
  for (let i = 1; i < med.length; i++) {
    acc = alpha * med[i] + (1 - alpha) * acc;
    fwd[i] = acc;
  }

  // --- anti-causal EMA (backward) ---
  const bwd: number[] = new Array(med.length);
  acc = med[med.length - 1];
  bwd[med.length - 1] = acc;
  for (let i = med.length - 2; i >= 0; i--) {
    acc = alpha * med[i] + (1 - alpha) * acc;
    bwd[i] = acc;
  }

  // --- zero-phase blend ---
  const out = fwd.map((v, i) => (v + bwd[i]) / 2);

  // optional: clamp if your data is nominally [0,1]
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.max(0, Math.min(1, out[i]));
  }
  return out;
}

const dispatchPlot = (eye: Eye, pred: number[], smooth?: number[], openTh?: number, closeTh?: number) => {
  const action =
    eye === 'combined'
      ? setCalibrationPlotCombined
      : eye === 'left'
      ? setCalibrationPlotLeft
      : setCalibrationPlotRight;

  store.dispatch(action({ pred, smooth }));

  // Keep the shared thresholds in sync (UI draws dashed lines using these)
  if (typeof openTh === 'number') store.dispatch(setBlinkOpenThreshold(openTh));
  if (typeof closeTh === 'number') store.dispatch(setBlinkCloseThreshold(closeTh));
};

/* ───────────────────────── Blink labelling ─── */

type Extremes = { smooth: number[]; peaks: number[]; valleys: number[] };

function labelBlinkExtrema(
  pred: number[],
  openTh = OPEN_TH_FIXED,
  closeTh = CLOSE_TH_FIXED,
): Extremes {
  const smooth = smoothSeries(pred, 5, 0.35);
  if (!smooth.length) return { smooth, peaks: [], valleys: [] };

  // Hysteresis with fixed thresholds
  const mid = (openTh + closeTh) / 2;

  enum State { CLOSED, OPEN }
  let state: State = smooth[0] >= mid ? State.OPEN : State.CLOSED;
  let segStart = 0;
  const peaks: number[] = [];
  const valleys: number[] = [];
  const minRun = 3;
  let overRun = 0, underRun = 0;

  const finishSegment = (endIdx: number, prev: State) => {
    if (segStart > endIdx) return;
    const idxs = Array.from({ length: endIdx - segStart + 1 }, (_, k) => segStart + k);
    if (prev === State.CLOSED) {
      const slice = smooth.slice(segStart, endIdx + 1);
      const minVal = Math.min(...slice);
      const plateau = idxs.filter(i => smooth[i] === minVal);
      valleys.push(plateau[(plateau.length / 2) | 0]);
    } else {
      const slice = smooth.slice(segStart, endIdx + 1);
      const maxVal = Math.max(...slice);
      const plateau = idxs.filter(i => smooth[i] === maxVal);
      peaks.push(plateau[(plateau.length / 2) | 0]);
    }
  };

  for (let i = 0; i < smooth.length; i++) {
    const y = smooth[i];
    if (state === State.CLOSED) {
      if (y >= openTh) { overRun++; underRun = 0; } else { overRun = 0; }
      if (overRun >= minRun) { finishSegment(i - minRun, State.CLOSED); state = State.OPEN; segStart = i - minRun + 1; overRun = 0; }
    } else {
      if (y <= closeTh) { underRun++; overRun = 0; } else { underRun = 0; }
      if (underRun >= minRun) { finishSegment(i - minRun, State.OPEN); state = State.CLOSED; segStart = i - minRun + 1; underRun = 0; }
    }
  }
  finishSegment(smooth.length - 1, state);

  // Ensure V–P–V pairing
  if (peaks.length && valleys.length) {
    if (peaks[0] < valleys[0]) peaks.shift();
    if (valleys[valleys.length - 1] < peaks[peaks.length - 1]) valleys.pop();
  }

  return { smooth, peaks, valleys };
}

/* ───────────────────────── Calibration (binary) ─── */

async function calibrateBinary(): Promise<void> {
  if (closedBuffer.combined && openBuffer.combined && closedBuffer.combined[0].length && openBuffer.combined[0].length) {
    await trainBinary('combined', closedBuffer.combined, openBuffer.combined);
    // diagnostics unchanged… use predictBinary(...)
  }
  if (closedBuffer.left && openBuffer.left && closedBuffer.left[0].length && openBuffer.left[0].length) {
    await trainBinary('left', closedBuffer.left, openBuffer.left);
    // diagnostics…
  }
  if (closedBuffer.right && openBuffer.right && closedBuffer.right[0].length && openBuffer.right[0].length) {
    await trainBinary('right', closedBuffer.right, openBuffer.right);
    // diagnostics…
  }
}

/* ───────────────────────── Blink inference & smooth model training ─── */

const runBlinkInferenceAndTrainForEye = async (eye: Eye) => {
  const mat = eye === 'combined' ? blinkBuffer.combined : eye === 'left' ? blinkBuffer.left : blinkBuffer.right;
  if (!mat || mat[0].length === 0) return;

  const frames = matToFrames(mat);
  const pred = frames.map(v => predictBinary(eye, v));

  // Single source of truth: same smooth & thresholds for UI and labeling
  const { smooth, peaks, valleys } = labelBlinkExtrema(pred, OPEN_TH_FIXED, CLOSE_TH_FIXED);

  // Plot exactly what labeling used
  dispatchPlot(eye, pred, smooth, OPEN_TH_FIXED, CLOSE_TH_FIXED);

  if (!peaks.length || !valleys.length) return;

  const trainingData: BlinkTrainingData = { latents: mat, peaks, valleys };
  await trainSmooth(eye, trainingData, { epochs: 150, learningRate: 0.001 });
};

/* ───────────────────────── Core loop ─── */

const collectAndMaybeCalibrate = async () => {
  const state: RootState = store.getState();

  // ----- CLOSED -----
  if (state.status.closedCalibrationActive) {
    if (!closedBuffer.ongoing) {
      resetBuffer(closedBuffer);
      closedBuffer.ongoing = true;
    }
    appendSamples(
      closedBuffer,
      state.status.latents.timestamp,
      state.status.latentsLeft.timestamp,
      state.status.latentsRight.timestamp,
      state.status.latents,
      state.status.latentsLeft,
      state.status.latentsRight,
    );
  } else if (closedBuffer.ongoing) {
    closedBuffer.ongoing = false;
    await calibrateBinary();
  }

  // ----- OPEN -----
  if (state.status.openCalibrationActive) {
    if (!openBuffer.ongoing) {
      resetBuffer(openBuffer);
      openBuffer.ongoing = true;
    }
    appendSamples(
      openBuffer,
      state.status.latents.timestamp,
      state.status.latentsLeft.timestamp,
      state.status.latentsRight.timestamp,
      state.status.latents,
      state.status.latentsLeft,
      state.status.latentsRight,
    );
  } else if (openBuffer.ongoing) {
    openBuffer.ongoing = false;
    await calibrateBinary();
  }

  // ----- BLINK -----
  if (state.status.blinkCalibrationActive) {
    if (!blinkBuffer.ongoing) {
      resetBuffer(blinkBuffer);
      blinkBuffer.ongoing = true;
    }
    appendSamples(
      blinkBuffer,
      state.status.latents.timestamp,
      state.status.latentsLeft.timestamp,
      state.status.latentsRight.timestamp,
      state.status.latents,
      state.status.latentsLeft,
      state.status.latentsRight,
    );
  } else if (blinkBuffer.ongoing) {
    blinkBuffer.ongoing = false;
    // Train smooth-blink for any eyes that have data
    await runBlinkInferenceAndTrainForEye('combined');
    await runBlinkInferenceAndTrainForEye('left');
    await runBlinkInferenceAndTrainForEye('right');
  }
};

/* ───────────────────────── Public API ─── */

export const startOpennessComputation = () => {
  // Subscribe to state changes and drive the calibration pipeline
  store.subscribe(() => {
    // Fire and forget; internal steps await as needed
    void collectAndMaybeCalibrate();
  });
  warmLoadPersistedModels();
};

// ── Public mapOpenness (try smooth; fallback to binary) ──
export const mapOpenness = (v: Vec3, eye: Eye): number => {
  const s = predictSmooth(eye, v);
  if (!Number.isNaN(s)) return s;
  return predictBinary(eye, v);
};

// (Optional) At app start, try loading persisted models:
export async function warmLoadPersistedModels() {
  await Promise.all([
    modelRegistry.loadIfExists(binKey('combined')),
    modelRegistry.loadIfExists(binKey('left')),
    modelRegistry.loadIfExists(binKey('right')),
    modelRegistry.loadIfExists(smoothKey('combined')),
    modelRegistry.loadIfExists(smoothKey('left')),
    modelRegistry.loadIfExists(smoothKey('right')),
  ]);
}