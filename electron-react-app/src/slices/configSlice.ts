// src/slices/configSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isValidIpPort } from '../utilities/validation';

/**
 * Represents the configuration state of the application.
 *
 * This interface defines various settings and flags that control the application's behavior,
 * including connectivity settings, tracking options, Kalman filter parameters, UI preferences, and more.
 */

/**
 * Geometry produced by the openness calibration step.
 * Duplicated here (instead of importing from the service)
 * to avoid any circular-dependency headaches.
 */
export interface MappingParams {
  /** projection of OPEN centroid onto axis */
  projOpen: number;
  /** projection of WIDE centroid (== axis length) */
  projWide: number;
  /** scaling factor 0‒projOpen → 0‒0.75 */
  scaleA: number;
  /** scaling factor projOpen‒projWide → 0.75‒1 */
  scaleB: number;
  /** closed-eye centroid (origin for projections) */
  origin: [number, number, number];
  /** unit vector pointing Closed → Wide */
  axis: [number, number, number];
}

export interface ConfigState {
  headsetPort: string;
  leftEye: string;
  rightEye: string;
  recordingRate: number;
  vrcOsc: string;
  vrcNative: boolean;
  trackingRate: number;
  modelFile: string;
  leftEyeForcedOffline: boolean;
  rightEyeForcedOffline: boolean;
  thetaForcedOffline: boolean;
  trackingConfigValidity: boolean;
  trackingForcedOffline: boolean;
  kalmanEnabled: boolean;
  kalmanEnabledOpenness: boolean;
  measurementNoise: number;
  kalmanQLow: number;
  kalmanQHigh: number;
  kalmanThreshold: number;
  kalmanThresholdOpenness: number;
  vrcftV1: boolean;
  vrcftV2: boolean;
  pitchOffset: number;
  independentEyes: boolean;
  independentOpenness: boolean;
  activeEyeTracking: boolean;
  activeOpennessTracking: boolean;
  opennessSliderHandles: [number, number];
  verticalExaggeration: number;
  horizontalExaggeration: number;
  oscPrefix: string;
  splitOutputY: boolean;
  syncedEyeUpdates: boolean;
  blinkReleaseDelayMs: number;
  eyelidBasedGazeTrust: boolean;
  language: string;
  theme: string;
  activeTabIndex: number;
  recordTrainingData: boolean;
  backgroundImageUrl: string;
  vrcNativeNeutralValue: number;
  trainCombinedAutoencoder: boolean;
  trainLeftAutoencoder: boolean;
  trainRightAutoencoder: boolean;
  convertCombinedAutoencoder: boolean;
  convertLeftAutoencoder: boolean;
  convertRightAutoencoder: boolean;
  outputTrainedModelPath: string;
  outputConvertedModelPath: string;
  calibrationPlotEnabled: boolean;
  calibrationPlotExpanded: boolean;
  blinkOpenThreshold: number;
  blinkCloseThreshold: number;
  ctxFilter: string;

  calibrationPlotData: {
    combined: number[] | null;
    left: number[] | null;
    right: number[] | null;
    smoothCombined: number[] | null;
    smoothLeft: number[] | null;
    smoothRight: number[] | null;
  };

  /** Persisted calibration parameters for openness mapping */
  mapping: {
    combined: MappingParams | null;
    left: MappingParams | null;
    right: MappingParams | null;
  };
}

export const initialState: ConfigState = {
  headsetPort: '5005',
  leftEye: '',
  rightEye: '',
  recordingRate: 25,
  vrcOsc: '127.0.0.1:9000',
  vrcNative: false,
  trackingRate: 25,
  modelFile: '',
  leftEyeForcedOffline: false,
  rightEyeForcedOffline: false,
  thetaForcedOffline: false,
  trackingConfigValidity: false,
  trackingForcedOffline: false,
  kalmanEnabled: true,
  kalmanEnabledOpenness: true,
  measurementNoise: 4,
  kalmanQLow: 0.03,
  kalmanQHigh: 50,
  kalmanThreshold: 2,
  kalmanThresholdOpenness: 0.03,
  vrcftV1: false,
  vrcftV2: false,
  pitchOffset: 0,
  independentEyes: false,
  independentOpenness: false,
  activeEyeTracking: true,
  activeOpennessTracking: false,
  opennessSliderHandles: [0.2, 0.80],
  verticalExaggeration: 1,
  horizontalExaggeration: 1,
  oscPrefix: 'ft/f/',
  splitOutputY: false,
  syncedEyeUpdates: false,
  blinkReleaseDelayMs: 25,
  eyelidBasedGazeTrust: true,
  language: 'English',
  theme: 'dark',
  activeTabIndex: 0,
  recordTrainingData: false,
  backgroundImageUrl: '',
  vrcNativeNeutralValue: 0.25,
  trainCombinedAutoencoder: false,
  trainLeftAutoencoder: false,
  trainRightAutoencoder: false,
  convertCombinedAutoencoder: false,
  convertLeftAutoencoder: false,
  convertRightAutoencoder: false,
  outputTrainedModelPath: "",
  outputConvertedModelPath: "",
  calibrationPlotEnabled: true,
  calibrationPlotExpanded: true,
  blinkOpenThreshold: 0.8,
  blinkCloseThreshold: 0.2,
  ctxFilter: "",

  calibrationPlotData: {
    combined: null,
    left: null,
    right: null,
    smoothCombined: null,
    smoothLeft: null,
    smoothRight: null,
  },

  mapping: {
    combined: null,
    left: null,
    right: null,
  },
};

const updateTrackingConfigValidity = (state: ConfigState) => {
  state.trackingConfigValidity =
    isValidIpPort(state.vrcOsc) &&
    (state.vrcNative || state.vrcftV1 || state.vrcftV2);
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setHeadsetPort(state, action: PayloadAction<string>) {
      state.headsetPort = action.payload;
    },
    setLeftEye(state, action: PayloadAction<string>) {
      state.leftEye = action.payload;
    },
    setRightEye(state, action: PayloadAction<string>) {
      state.rightEye = action.payload;
    },
    setRecordingRate(state, action: PayloadAction<number>) {
      state.recordingRate = action.payload;
    },
    setVrcOsc(state, action: PayloadAction<string>) {
      state.vrcOsc = action.payload;
      updateTrackingConfigValidity(state);
    },
    setTrackingRate(state, action: PayloadAction<number>) {
      state.trackingRate = action.payload;
    },
    setModelFile(state, action: PayloadAction<string>) {
      state.modelFile = action.payload;
    },
    toggleLeftEyeForcedOffline(state) {
      state.leftEyeForcedOffline = !state.leftEyeForcedOffline;
    },
    toggleRightEyeForcedOffline(state) {
      state.rightEyeForcedOffline = !state.rightEyeForcedOffline;
    },
    toggleThetaForcedOffline(state) {
      state.thetaForcedOffline = !state.thetaForcedOffline;
    },
    toggleTrackingForcedOffline(state) {
      state.trackingForcedOffline = !state.trackingForcedOffline;
    },
    setKalmanEnabled(state, action: PayloadAction<boolean>) {
      state.kalmanEnabled = action.payload;
    },
    setKalmanEnabledOpenness(state, action: PayloadAction<boolean>) {
      state.kalmanEnabledOpenness = action.payload;
    },
    setMeasurementNoise(state, action: PayloadAction<number>) {
      state.measurementNoise = action.payload;
    },
    setKalmanQLow(state, action: PayloadAction<number>) {
      state.kalmanQLow = action.payload;
    },
    setKalmanQHigh(state, action: PayloadAction<number>) {
      state.kalmanQHigh = action.payload;
    },
    setKalmanThreshold(state, action: PayloadAction<number>) {
      state.kalmanThreshold = action.payload;
    },
    setKalmanThresholdOpenness(state, action: PayloadAction<number>) {
      state.kalmanThresholdOpenness = action.payload;
    },
    setVrcNative(state, action: PayloadAction<boolean>) {
      if (action.payload) {
        state.vrcNative = true;
        state.vrcftV1 = false;
        state.vrcftV2 = false;
      } else {
        state.vrcNative = false;
      }
      updateTrackingConfigValidity(state);
    },
    toggleVrcftV1(state) {
      if (!state.vrcftV1) {
        state.vrcftV1 = true;
        state.vrcNative = false;
        state.vrcftV2 = false;
      } else {
        state.vrcftV1 = false;
      }
      updateTrackingConfigValidity(state);
    },
    toggleVrcftV2(state) {
      if (!state.vrcftV2) {
        state.vrcftV2 = true;
        state.vrcNative = false;
        state.vrcftV1 = false;
      } else {
        state.vrcftV2 = false;
      }
      updateTrackingConfigValidity(state);
    },
    setPitchOffset(state, action: PayloadAction<number>) {
      state.pitchOffset = action.payload;
    },
    setIndependentEyes(state, action: PayloadAction<boolean>) {
      state.independentEyes = action.payload;
    },
    setIndependentOpenness(state, action: PayloadAction<boolean>) {
      state.independentOpenness = action.payload;
    },
    setActiveEyeTracking(state, action: PayloadAction<boolean>) {
      state.activeEyeTracking = action.payload;
    },
    setActiveOpennessTracking(state, action: PayloadAction<boolean>) {
      state.activeOpennessTracking = action.payload;
    },
    setOpennessSliderHandles(
      state,
      action: PayloadAction<[number, number]>,
    ) {
      state.opennessSliderHandles = action.payload;
    },
    setVerticalExaggeration(state, action: PayloadAction<number>) {
      state.verticalExaggeration = action.payload;
    },
    setHorizontalExaggeration(state, action: PayloadAction<number>) {
      state.horizontalExaggeration = action.payload;
    },
    setOscPrefix(state, action: PayloadAction<string>) {
      state.oscPrefix = action.payload;
    },
    setSplitOutputY(state, action: PayloadAction<boolean>) {
      state.splitOutputY = action.payload;
    },
    setSyncedEyeUpdates(state, action: PayloadAction<boolean>) {
      state.syncedEyeUpdates = action.payload;
    },
    setBlinkReleaseDelayMs(state, action: PayloadAction<number>) {
      state.blinkReleaseDelayMs = action.payload;
    },
    setEyelidBasedGazeTrust(state, action: PayloadAction<boolean>) {
      state.eyelidBasedGazeTrust = action.payload;
    },
    setLanguage(state, action: PayloadAction<string>) {
      state.language = action.payload;
    },
    setTheme(state, action: PayloadAction<string>) {
      state.theme = action.payload;
    },
    setActiveTabIndex(state, action: PayloadAction<number>) {
      state.activeTabIndex = action.payload;
    },
    setRecordTrainingData(state, action: PayloadAction<boolean>) {
      state.recordTrainingData = action.payload;
    },
    setBackgroundImageUrl(state, action: PayloadAction<string>) {
      state.backgroundImageUrl = action.payload;
    },
    setvrcNativeNeutralValue(state, action: PayloadAction<number>) {
      state.vrcNativeNeutralValue = action.payload;
    },
    setTrainCombinedAutoencoder(state, action: PayloadAction<boolean>) {
      state.trainCombinedAutoencoder = action.payload;
    },
    setTrainLeftAutoencoder(state, action: PayloadAction<boolean>) {
      state.trainLeftAutoencoder = action.payload;
    },
    setTrainRightAutoencoder(state, action: PayloadAction<boolean>) {
      state.trainRightAutoencoder = action.payload;
    },
    setConvertCombinedAutoencoder(state, action: PayloadAction<boolean>) {
      state.convertCombinedAutoencoder = action.payload;
    },
    setConvertLeftAutoencoder(state, action: PayloadAction<boolean>) {
      state.convertLeftAutoencoder = action.payload;
    },
    setConvertRightAutoencoder(state, action: PayloadAction<boolean>) {
      state.convertRightAutoencoder = action.payload;
    },
    setOutputTrainedModelPath(state, action: PayloadAction<string>) {
      state.outputTrainedModelPath = action.payload;
    },
    setOutputConvertedModelPath(state, action: PayloadAction<string>) {
      state.outputConvertedModelPath = action.payload;
    },
    setCalibrationPlotEnabled(state, action: PayloadAction<boolean>) {
      state.calibrationPlotEnabled = action.payload;
    },
    toggleCalibrationPlotExpanded(state) {
      state.calibrationPlotExpanded = !state.calibrationPlotExpanded;
    },
    setBlinkOpenThreshold(state, action: PayloadAction<number>) {
      state.blinkOpenThreshold = action.payload;
    },
    setBlinkCloseThreshold(state, action: PayloadAction<number>) {
      state.blinkCloseThreshold = action.payload;
    },
    setCalibrationPlotCombined(state, action: PayloadAction<{ pred: number[]; smooth?: number[] }>) {
      state.calibrationPlotData.combined = action.payload.pred ?? null;
      state.calibrationPlotData.smoothCombined = action.payload.smooth ?? null;
    },
    setCalibrationPlotLeft(state, action: PayloadAction<{ pred: number[]; smooth?: number[] }>) {
      state.calibrationPlotData.left = action.payload.pred ?? null;
      state.calibrationPlotData.smoothLeft = action.payload.smooth ?? null;
    },
    setCalibrationPlotRight(state, action: PayloadAction<{ pred: number[]; smooth?: number[] }>) {
      state.calibrationPlotData.right = action.payload.pred ?? null;
      state.calibrationPlotData.smoothRight = action.payload.smooth ?? null;
    },
    setCtxFilter(state, action: PayloadAction<string>) {
      state.ctxFilter = action.payload;
    },
    clearCalibrationPlots(state) {
      state.calibrationPlotData = {
        combined: null,
        left: null,
        right: null,
        smoothCombined: null,
        smoothLeft: null,
        smoothRight: null,
      };
    },

    setMappings(
      state,
      action: PayloadAction<{
        combined: MappingParams;
        left: MappingParams;
        right: MappingParams;
      }>,
    ) {
      state.mapping = {
        combined: action.payload.combined,
        left: action.payload.left,
        right: action.payload.right,
      };
    },
  },
});

export const {
  setHeadsetPort,
  setLeftEye,
  setRightEye,
  setRecordingRate,
  setVrcOsc,
  setVrcNative,
  setTrackingRate,
  setModelFile,
  toggleLeftEyeForcedOffline,
  toggleRightEyeForcedOffline,
  toggleThetaForcedOffline,
  toggleTrackingForcedOffline,
  setKalmanEnabled,
  setKalmanEnabledOpenness,
  setMeasurementNoise,
  setKalmanQLow,
  setKalmanQHigh,
  setKalmanThreshold,
  setKalmanThresholdOpenness,
  toggleVrcftV1,
  toggleVrcftV2,
  setPitchOffset,
  setIndependentEyes,
  setIndependentOpenness,
  setActiveEyeTracking,
  setActiveOpennessTracking,
  setOpennessSliderHandles,
  setVerticalExaggeration,
  setHorizontalExaggeration,
  setOscPrefix,
  setSplitOutputY,
  setSyncedEyeUpdates,
  setBlinkReleaseDelayMs,
  setEyelidBasedGazeTrust,
  setLanguage,
  setTheme,
  setActiveTabIndex,
  setRecordTrainingData,
  setBackgroundImageUrl,
  setvrcNativeNeutralValue,
  setTrainCombinedAutoencoder,
  setTrainLeftAutoencoder,
  setTrainRightAutoencoder,
  setConvertCombinedAutoencoder,
  setConvertLeftAutoencoder,
  setConvertRightAutoencoder,
  setMappings,
  setOutputTrainedModelPath,
  setOutputConvertedModelPath,
  setCalibrationPlotEnabled,
  toggleCalibrationPlotExpanded,
  setBlinkOpenThreshold,
  setBlinkCloseThreshold,
  setCalibrationPlotCombined,
  setCalibrationPlotLeft,
  setCalibrationPlotRight,
  clearCalibrationPlots,
  setCtxFilter,
} = configSlice.actions;

export default configSlice.reducer;