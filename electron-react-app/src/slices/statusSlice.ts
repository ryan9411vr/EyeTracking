// src/slices/statusSlice.ts

/**
 * @module statusSlice
 *
 * Manages connection and data status for camera frames, theta data, tracking
 * data, latent vectors, and calibration‑button state.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  toggleLeftEyeForcedOffline,
  toggleRightEyeForcedOffline,
} from "../slices/configSlice";

export type ConnectionStatus = "online" | "offline" | "warning";

export interface CameraFrame {
  frame: string;
  timestamp: number | null;
  status: ConnectionStatus;
}

export interface LatentData {
  theta1: number;
  theta2: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  unsupervised1: number;
  unsupervised2: number;
  unsupervised3: number;
  timestamp: number | null;
}

export interface OpennessData {
  opennessCombined: number;
  opennessLeft: number;
  opennessRight: number;
}

export interface ThetaData {
  theta1: number;
  theta2: number;
  status: "online" | "offline";
  timestamp: number | null;
  record: boolean;
  deleteRecent: boolean;
  openness: number;
  mode: string;
}

export interface StatusState {
  database: ConnectionStatus;
  imageData: {
    leftEye: CameraFrame;
    rightEye: CameraFrame;
  };
  theta: ThetaData;
  latents: LatentData;
  latentsLeft: LatentData;
  latentsRight: LatentData;
  opennessData: OpennessData;
  heatmapImageData: string | null;

  /** Calibration‑button momentary state */
  closedCalibrationActive: boolean;
  openCalibrationActive: boolean;
  blinkCalibrationActive: boolean;
}

const zeroLatents: LatentData = {
  theta1: 0,
  theta2: 0,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  unsupervised1: 0,
  unsupervised2: 0,
  unsupervised3: 0,
  timestamp: null,
};

const initialState: StatusState = {
  database: "offline",
  imageData: {
    leftEye: { frame: "", timestamp: null, status: "offline" },
    rightEye: { frame: "", timestamp: null, status: "offline" },
  },
  theta: {
    theta1: 0,
    theta2: 0,
    status: "offline",
    timestamp: null,
    record: false,
    deleteRecent: false,
    openness: 0.75,
    mode: "gaze",
  },
  latents: { ...zeroLatents },
  latentsLeft: { ...zeroLatents },
  latentsRight: { ...zeroLatents },
  opennessData: {
    opennessCombined: 0,
    opennessLeft: 0,
    opennessRight: 0,
  },
  heatmapImageData: null,

  /* Calibration buttons */
  closedCalibrationActive: false,
  openCalibrationActive: false,
  blinkCalibrationActive: false,
};

const statusSlice = createSlice({
  name: "status",
  initialState,
  reducers: {
    /* Camera & theta */
    setCameraFrame(
      state,
      action: PayloadAction<{
        side: "leftEye" | "rightEye";
        frame: string;
        timestamp: number;
        status: ConnectionStatus;
      }>
    ) {
      const { side, frame, timestamp, status: connStatus } = action.payload;
      state.imageData[side] = { frame, timestamp, status: connStatus };
    },

    setThetaData(
      state,
      action: PayloadAction<{
        theta1: number;
        theta2: number;
        timestamp: number;
        record: boolean;
        deleteRecent: boolean;
        openness: number;
        mode: string;
      }>
    ) {
      state.theta = {
        ...state.theta,
        theta1: action.payload.theta1,
        theta2: action.payload.theta2,
        timestamp: action.payload.timestamp,
        record: action.payload.record,
        deleteRecent: action.payload.deleteRecent,
        openness: action.payload.openness,
        mode: action.payload.mode,
        status: "online",
      };
    },

    setThetaStatus(state, action: PayloadAction<"online" | "offline">) {
      state.theta.status = action.payload;
    },

    /* Latent vectors */
    updateLatents(state, action: PayloadAction<LatentData>) {
      state.latents = { ...action.payload };
    },
    updateLatentsLeft(state, action: PayloadAction<LatentData>) {
      state.latentsLeft = { ...action.payload };
    },
    updateLatentsRight(state, action: PayloadAction<LatentData>) {
      state.latentsRight = { ...action.payload };
    },

    /* Openness (Computed from Latents) */
    updateOpennessCombined(state, action: PayloadAction<number>) {
      state.opennessData.opennessCombined = action.payload;
    },
    updateOpennessLeft(state, action: PayloadAction<number>) {
      state.opennessData.opennessLeft = action.payload;
    },
    updateOpennessRight(state, action: PayloadAction<number>) {
      state.opennessData.opennessRight = action.payload;
    },

    /* Calibration‑button reducers */
    setClosedCalibrationActive(state, action: PayloadAction<boolean>) {
      state.closedCalibrationActive = action.payload;
    },
    setOpenCalibrationActive(state, action: PayloadAction<boolean>) {
      state.openCalibrationActive = action.payload;
    },
    setBlinkCalibrationActive(state, action: PayloadAction<boolean>) {
      state.blinkCalibrationActive = action.payload;
    },

    /* Misc visuals / job ids */
    setHeatmapImageData(state, action: PayloadAction<string | null>) {
      state.heatmapImageData = action.payload;
    },
  },

  extraReducers: (builder) => {
    builder.addCase(toggleLeftEyeForcedOffline, (state) => {
      state.imageData.leftEye.frame = "";
      state.imageData.leftEye.timestamp = Date.now();
      state.imageData.leftEye.status = "offline";
    });
    builder.addCase(toggleRightEyeForcedOffline, (state) => {
      state.imageData.rightEye.frame = "";
      state.imageData.rightEye.timestamp = Date.now();
      state.imageData.rightEye.status = "offline";
    });
  },
});

export const {
  setCameraFrame,
  setThetaData,
  setThetaStatus,
  setHeatmapImageData,
  updateLatents,
  updateLatentsLeft,
  updateLatentsRight,
  setClosedCalibrationActive,
  setOpenCalibrationActive,
  setBlinkCalibrationActive,
  updateOpennessCombined,
  updateOpennessLeft,
  updateOpennessRight,
} = statusSlice.actions;

export default statusSlice.reducer;
