// src/slices/configSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isValidIpPort } from '../utilities/validation';

/**
 * Represents the configuration state of the application.
 *
 * This interface defines various settings and flags that control the application's behavior,
 * including connectivity settings, tracking options, Kalman filter parameters, UI preferences, and more.
 */
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
  opennessSliderHandles: [number, number, number, number];
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
}

/**
 * The initial configuration state with default values.
 */
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
  kalmanThresholdOpenness: .03,
  vrcftV1: false,
  vrcftV2: false,
  pitchOffset: 0,
  independentEyes: false,
  independentOpenness: false,
  activeEyeTracking: true,
  activeOpennessTracking: false,
  opennessSliderHandles: [0.15, 0.65, 0.95, 1.0],
  verticalExaggeration: 1,
  horizontalExaggeration: 1,
  oscPrefix: 'ft/f/',
  splitOutputY: false,
  syncedEyeUpdates: false,
  blinkReleaseDelayMs: 25,
  eyelidBasedGazeTrust: true,
  language: "English",
  theme: "dark",
  activeTabIndex: 0,
  recordTrainingData: false,
  backgroundImageUrl: '',
  vrcNativeNeutralValue: .25,
};

/**
 * Updates the tracking configuration validity flag based on current settings.
 *
 * The tracking configuration is considered valid if the vrcOsc string is a valid IP:Port
 * and at least one tracking mode (vrcNative, vrcftV1, or vrcftV2) is enabled.
 *
 * @param state - The current configuration state.
 */
const updateTrackingConfigValidity = (state: ConfigState) => {
  state.trackingConfigValidity =
    isValidIpPort(state.vrcOsc) &&
    (state.vrcNative || state.vrcftV1 || state.vrcftV2);
};

/**
 * Redux slice for managing configuration state.
 *
 * This slice contains actions and reducers for updating various configuration settings.
 * Some reducers update dependent state (for example, trackingConfigValidity) automatically
 * when related properties change.
 */
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
    setOpennessSliderHandles(state, action: PayloadAction<[number, number, number, number]>) {
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
  },
});

// Export all actions for use in components.
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
} = configSlice.actions;

export default configSlice.reducer;
