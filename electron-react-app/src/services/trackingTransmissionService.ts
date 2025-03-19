// src/services/trackingTransmissionService.ts

/**
 * Tracking Transmission Service
 *
 * This module handles the transmission of computed tracking data via OSC messages.
 * It compares new computed tracking values (for eye movements and openness) with previously
 * sent values to decide when to send updated OSC messages. The service supports multiple
 * transmission modes (native, vrcftV1, and vrcftV2) and applies specific rules for each mode,
 * including blink-release logic and transformation of openness values. The module maintains
 * global state for previous tracking values to minimize redundant transmissions.
 */

import store from '../store';
import { EyeSelectionUtils } from '../utilities/eyeSelectionUtils';
import { EqualityUtils } from '../utilities/equalityUtils';
import { OscSenderUtils } from '../utilities/OscSenderUtils';

/* -------------------------------------------------------------------
   Global variables for previous values (for change detection)
   These variables store the last sent tracking values for each transmission mode.
   ------------------------------------------------------------------- */

// Native mode previous values:
let previousNativeCombinedThetas: { theta1: number; theta2: number } | null = null;
let previousNativeIndependentThetas:
  | { leftTheta1: number; leftTheta2: number; rightTheta1: number; rightTheta2: number }
  | null = null;
let previousNativeOpenness: number | null = null;

// VRCFT V1 previous values:
let previousVrcftV1CombinedThetas: { theta1: number; theta2: number } | null = null;
let previousVrcftV1IndependentThetas:
  | { leftTheta1: number; leftTheta2: number; rightTheta1: number; rightTheta2: number }
  | null = null;
let previousVrcftV1OpennessCombined: number | null = null;
let previousVrcftV1OpennessIndependent:
  | { leftOpenness: number; rightOpenness: number }
  | null = null;

// VRCFT V2 previous values:
let previousVrcftV2CombinedThetas: { theta1: number; theta2: number } | null = null;
let previousVrcftV2IndependentThetas:
  | { leftTheta1: number; leftTheta2: number; rightTheta1: number; rightTheta2: number }
  | null = null;
let previousVrcftV2OpennessCombined: number | null = null;
let previousVrcftV2OpennessIndependent:
  | { leftOpenness: number; rightOpenness: number }
  | null = null;

// Previous OSC endpoint to detect changes:
let previousOscEndpoint: string | undefined = undefined;

/* -------------------------------------------------------------------
   Timestamps for managing blink release delay.
   These variables are used to implement a delay before releasing a blink state.
   ------------------------------------------------------------------- */
let lastClosedTimestampCombined = 0;
let lastClosedTimestampLeft = 0;
let lastClosedTimestampRight = 0;

/**
 * Transforms the raw openness value based on a provided configuration.
 *
 * Rules:
 * - If the value is less than opennessConfig[0]          -> output 0.
 * - If between opennessConfig[0] and opennessConfig[1]   -> scale smoothly from 0 to 0.75.
 * - If between opennessConfig[1] and opennessConfig[2]   -> output 0.75.
 * - If between opennessConfig[2] and opennessConfig[3]   -> scale smoothly from 0.75 to 1.
 * - If the value is greater than opennessConfig[3]       -> output 1.
 *
 * @param value - The raw openness value.
 * @param opennessConfig - A tuple defining the thresholds for transformation.
 * @returns The transformed openness value.
 */
function transformOpenness(
  value: number,
  opennessConfig: [number, number, number, number]
): number {
  if (value < opennessConfig[0]) {
    return 0;
  } else if (value < opennessConfig[1]) {
    return ((value - opennessConfig[0]) / (opennessConfig[1] - opennessConfig[0])) * 0.75;
  } else if (value < opennessConfig[2]) {
    return 0.75;
  } else if (value < opennessConfig[3]) {
    return 0.75 + ((value - opennessConfig[2]) / (opennessConfig[3] - opennessConfig[2])) * 0.25;
  } else {
    return 1;
  }
}

/* -------------------------------------------------------------------
   Main Transmission Function
   This function computes the current tracking data and sends updated OSC messages
   based on the selected transmission mode and state changes.
   ------------------------------------------------------------------- */
export function startTrackingTransmission() {
  const state = store.getState();
  const {
    vrcNative,
    vrcOsc,
    vrcftV1,
    vrcftV2,
    trackingForcedOffline,
    pitchOffset,
    independentEyes,
    independentOpenness,
    activeEyeTracking,
    activeOpennessTracking,
    opennessSliderHandles,
    verticalExaggeration,
    horizontalExaggeration,
    oscPrefix,
    splitOutputY,
    blinkReleaseDelayMs,
    vrcNativeNeutralValue,
  } = state.config;

  // 1. Determine the current transmission mode and OSC endpoint.
  let currentMode: string = 'none';
  let currentEndpoint = '';

  if (trackingForcedOffline) {
    currentMode = 'none';
  } else if (vrcNative) {
    currentMode = 'native';
    currentEndpoint = vrcOsc;
  } else if (vrcftV1) {
    currentMode = 'vrcftV1';
    currentEndpoint = vrcOsc;
  } else if (vrcftV2) {
    currentMode = 'vrcftV2';
    currentEndpoint = vrcOsc;
  } else {
    currentMode = 'none';
  }

  // 2. Update the OSC client if the endpoint has changed.
  if (currentMode !== 'none' && currentEndpoint && currentEndpoint !== previousOscEndpoint) {
    if (window.electronAPI?.updateOscClient) {
      console.log('Updating OSC Client to = ' + currentEndpoint);
      window.electronAPI.updateOscClient(currentEndpoint);
    }
    previousOscEndpoint = currentEndpoint;
  } else if (currentMode === 'none') {
    previousOscEndpoint = '';
  }

  // 3. If no valid transmission mode is set, exit early.
  if (currentMode === 'none') return;

  // 4. Compute and compare tracking values, then send OSC messages accordingly.
  // --- NATIVE MODE ---
  if (currentMode === 'native') {
    // Eye movement (Pitch/Yaw)
    if (activeEyeTracking) {
      if (independentEyes) {
        const newIndThetas = EyeSelectionUtils.chooseIndependentEyeThetas();
        if (
          !previousNativeIndependentThetas ||
          !EqualityUtils.isEqualIndThetas(newIndThetas, previousNativeIndependentThetas)
        ) {
          previousNativeIndependentThetas = newIndThetas;
          OscSenderUtils.sendNativeIndependentPitchYaw(
            newIndThetas,
            pitchOffset,
            verticalExaggeration,
            horizontalExaggeration
          );
        }
      } else {
        const newCombinedThetas = EyeSelectionUtils.chooseCombinedEyeThetas();
        if (
          !previousNativeCombinedThetas ||
          !EqualityUtils.isEqualCombinedThetas(newCombinedThetas, previousNativeCombinedThetas)
        ) {
          previousNativeCombinedThetas = newCombinedThetas;
          OscSenderUtils.sendNativeCombinedPitchYaw(
            newCombinedThetas,
            pitchOffset,
            verticalExaggeration,
            horizontalExaggeration
          );
        }
      }
    }

    // Eye Openness (VRC Native supports only combined eye openness)
    if (activeOpennessTracking) {
      let newCombinedOpenness = EyeSelectionUtils.chooseCombinedEyeOpenness();
      newCombinedOpenness = transformOpenness(newCombinedOpenness, opennessSliderHandles);
      const now = Date.now();

      // Apply blink-release logic.
      if (newCombinedOpenness === 0) {
        lastClosedTimestampCombined = now;
      } else if (now <= lastClosedTimestampCombined + blinkReleaseDelayMs) {
        newCombinedOpenness = 0;
      }

      if (
        previousNativeOpenness === null ||
        Math.abs(previousNativeOpenness - newCombinedOpenness) > 0.001
      ) {
        previousNativeOpenness = newCombinedOpenness;
        OscSenderUtils.sendNativeEyeOpenness(newCombinedOpenness, vrcNativeNeutralValue);
      }
    }

  // --- VRCFT V1 MODE ---
  } else if (currentMode === 'vrcftV1') {
    // Eye movement (Pitch/Yaw)
    if (activeEyeTracking) {
      if (independentEyes) {
        const newIndThetas = EyeSelectionUtils.chooseIndependentEyeThetas();
        if (
          !previousVrcftV1IndependentThetas ||
          !EqualityUtils.isEqualIndThetas(newIndThetas, previousVrcftV1IndependentThetas)
        ) {
          previousVrcftV1IndependentThetas = newIndThetas;
          OscSenderUtils.sendVrcftV1IndependentPitchYaw(
            newIndThetas,
            pitchOffset,
            verticalExaggeration,
            horizontalExaggeration
          );
        }
      } else {
        const newCombinedThetas = EyeSelectionUtils.chooseCombinedEyeThetas();
        if (
          !previousVrcftV1CombinedThetas ||
          !EqualityUtils.isEqualCombinedThetas(newCombinedThetas, previousVrcftV1CombinedThetas)
        ) {
          previousVrcftV1CombinedThetas = newCombinedThetas;
          OscSenderUtils.sendVrcftV1CombinedPitchYaw(
            newCombinedThetas,
            pitchOffset,
            verticalExaggeration,
            horizontalExaggeration
          );
        }
      }
    }

    // Eye Openness
    if (activeOpennessTracking) {
      if (independentOpenness) {
        const newIndOpenness = EyeSelectionUtils.chooseIndependentEyeOpenness();
        let leftOpenness = transformOpenness(newIndOpenness.leftOpenness, opennessSliderHandles);
        let rightOpenness = transformOpenness(newIndOpenness.rightOpenness, opennessSliderHandles);
        const now = Date.now();

        // Apply blink-release logic for each eye.
        if (leftOpenness === 0) {
          lastClosedTimestampLeft = now;
        } else if (now <= lastClosedTimestampLeft + blinkReleaseDelayMs) {
          leftOpenness = 0;
        }
        if (rightOpenness === 0) {
          lastClosedTimestampRight = now;
        } else if (now <= lastClosedTimestampRight + blinkReleaseDelayMs) {
          rightOpenness = 0;
        }

        const newValue = { leftOpenness, rightOpenness };
        if (
          !previousVrcftV1OpennessIndependent ||
          !EqualityUtils.isEqualOpenness(newValue, previousVrcftV1OpennessIndependent)
        ) {
          previousVrcftV1OpennessIndependent = newValue;
          OscSenderUtils.sendVrcftV1IndependentOpenness(newValue);
        }
      } else {
        let newCombinedOpenness = EyeSelectionUtils.chooseCombinedEyeOpenness();
        newCombinedOpenness = transformOpenness(newCombinedOpenness, opennessSliderHandles);
        const now = Date.now();

        let finalCombined = newCombinedOpenness;
        if (finalCombined === 0) {
          lastClosedTimestampCombined = now;
        } else if (now <= lastClosedTimestampCombined + blinkReleaseDelayMs) {
          finalCombined = 0;
        }

        if (
          previousVrcftV1OpennessCombined === null ||
          Math.abs(previousVrcftV1OpennessCombined - finalCombined) > 0.001
        ) {
          previousVrcftV1OpennessCombined = finalCombined;
          OscSenderUtils.sendVrcftV1CombinedOpenness(finalCombined);
        }
      }
    }

  // --- VRCFT V2 MODE ---
  } else if (currentMode === 'vrcftV2') {
    // Eye movement (Pitch/Yaw)
    if (activeEyeTracking) {
      if (independentEyes) {
        const newIndThetas = EyeSelectionUtils.chooseIndependentEyeThetas();
        if (
          !previousVrcftV2IndependentThetas ||
          !EqualityUtils.isEqualIndThetas(newIndThetas, previousVrcftV2IndependentThetas)
        ) {
          previousVrcftV2IndependentThetas = newIndThetas;
          OscSenderUtils.sendVrcftV2IndependentPitchYaw(
            newIndThetas,
            pitchOffset,
            verticalExaggeration,
            horizontalExaggeration,
            oscPrefix,
            splitOutputY
          );
        }
      } else {
        const newCombinedThetas = EyeSelectionUtils.chooseCombinedEyeThetas();
        if (
          !previousVrcftV2CombinedThetas ||
          !EqualityUtils.isEqualCombinedThetas(newCombinedThetas, previousVrcftV2CombinedThetas)
        ) {
          previousVrcftV2CombinedThetas = newCombinedThetas;
          OscSenderUtils.sendVrcftV2CombinedPitchYaw(
            newCombinedThetas,
            pitchOffset,
            verticalExaggeration,
            horizontalExaggeration,
            oscPrefix,
            splitOutputY
          );
        }
      }
    }

    // Eye Openness
    if (activeOpennessTracking) {
      if (independentOpenness) {
        const newIndOpenness = EyeSelectionUtils.chooseIndependentEyeOpenness();
        let leftOpenness = transformOpenness(newIndOpenness.leftOpenness, opennessSliderHandles);
        let rightOpenness = transformOpenness(newIndOpenness.rightOpenness, opennessSliderHandles);
        const now = Date.now();

        // Apply blink-release logic for each eye.
        if (leftOpenness === 0) {
          lastClosedTimestampLeft = now;
        } else if (now <= lastClosedTimestampLeft + blinkReleaseDelayMs) {
          leftOpenness = 0;
        }
        if (rightOpenness === 0) {
          lastClosedTimestampRight = now;
        } else if (now <= lastClosedTimestampRight + blinkReleaseDelayMs) {
          rightOpenness = 0;
        }

        const newValue = { leftOpenness, rightOpenness };
        if (
          !previousVrcftV2OpennessIndependent ||
          !EqualityUtils.isEqualOpenness(newValue, previousVrcftV2OpennessIndependent)
        ) {
          previousVrcftV2OpennessIndependent = newValue;
          OscSenderUtils.sendVrcftV2IndependentOpenness(newValue, oscPrefix);
        }
      } else {
        let newCombinedOpenness = EyeSelectionUtils.chooseCombinedEyeOpenness();
        newCombinedOpenness = transformOpenness(newCombinedOpenness, opennessSliderHandles);
        const now = Date.now();

        let finalCombined = newCombinedOpenness;
        if (finalCombined === 0) {
          lastClosedTimestampCombined = now;
        } else if (now <= lastClosedTimestampCombined + blinkReleaseDelayMs) {
          finalCombined = 0;
        }

        if (
          previousVrcftV2OpennessCombined === null ||
          Math.abs(previousVrcftV2OpennessCombined - finalCombined) > 0.001
        ) {
          previousVrcftV2OpennessCombined = finalCombined;
          OscSenderUtils.sendVrcftV2CombinedOpenness(finalCombined, oscPrefix);
        }
      }
    }
  }
}
