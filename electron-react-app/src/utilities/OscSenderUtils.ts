// src/utilities/OscSenderUtils.ts

import { NormalizationUtils } from './NormalizationUtils';

/**
 * Provides functions for sending OSC (Open Sound Control) messages
 * to drive avatar parameters based on normalized eye tracking data.
 *
 * These functions apply scaling, offset adjustments, and clamping to raw angle and openness data,
 * then send the computed values via a custom Electron API.
 *
 * The functions are grouped by target tracking system:
 * - Native
 * - VRCFaceTracking V1
 * - VRCFaceTracking V2
 */
export class OscSenderUtils {
  /* ====================== Private Helper Methods ====================== */

  /**
   * Clamps a value between a minimum and maximum.
   *
   * @param value - The value to clamp.
   * @param min - The lower bound.
   * @param max - The upper bound.
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Scales a value by a multiplier and clamps the result between -1 and 1.
   *
   * @param value - The normalized value to scale.
   * @param multiplier - The scaling factor.
   * @returns The scaled and clamped value.
   */
  private static scaleAndClamp(value: number, multiplier: number): number {
    return OscSenderUtils.clamp(value * multiplier, -1, 1);
  }

  /**
   * Applies an offset to a normalized value, scales it by a multiplier,
   * and clamps the result between -1 and 1.
   *
   * @param value - The normalized value.
   * @param offset - The offset to subtract.
   * @param multiplier - The scaling factor.
   * @returns The offset, scaled, and clamped value.
   */
  private static scaleOffsetAndClamp(value: number, offset: number, multiplier: number): number {
    return OscSenderUtils.clamp((value - offset) * multiplier, -1, 1);
  }

  /**
   * Calculates the offset fraction based on the pitch offset and the current
   * maximum positive and negative theta1 values.
   *
   * @param pitchOffset - The pitch offset value.
   * @returns The calculated offset fraction.
   */
  private static calculateOffsetFraction(pitchOffset: number): number {
    if (pitchOffset === 0) return 0;
    return (2 * pitchOffset) / (NormalizationUtils.maxPosTheta1 + Math.abs(NormalizationUtils.maxNegTheta1));
  }

  /* ====================== Native Tracking ====================== */

  /**
   * Sends combined pitch and yaw data for native eye tracking.
   *
   * Applies a pitch offset and scaling factors to raw theta values, then sends the values via OSC.
   *
   * @param data - An object containing raw theta1 and theta2 values.
   * @param pitchOffset - The offset to subtract from theta1 (pitch adjustment).
   * @param verticalExaggeration - The factor to scale the vertical component.
   * @param horizontalExaggeration - The factor to scale the horizontal component.
   */
  static sendNativeCombinedPitchYaw(
    data: { theta1: number; theta2: number },
    pitchOffset: number,
    verticalExaggeration: number,
    horizontalExaggeration: number
  ) {
    const offsetTheta1 = (data.theta1 - pitchOffset) * verticalExaggeration;
    const scaledTheta2 = data.theta2 * horizontalExaggeration;
    window.electronAPI.sendOscEyeData(offsetTheta1, scaledTheta2);
  }

  /**
   * Sends independent pitch and yaw data for native eye tracking.
   *
   * Processes separate left and right theta values, applying a pitch offset and scaling factors
   * for each eye before sending via OSC.
   *
   * @param data - An object containing raw left and right theta values.
   * @param pitchOffset - The pitch offset to apply.
   * @param verticalExaggeration - Vertical scaling factor.
   * @param horizontalExaggeration - Horizontal scaling factor.
   */
  static sendNativeIndependentPitchYaw(
    data: {
      leftTheta1: number;
      leftTheta2: number;
      rightTheta1: number;
      rightTheta2: number;
    },
    pitchOffset: number,
    verticalExaggeration: number,
    horizontalExaggeration: number
  ) {
    const leftOffset = (data.leftTheta1 - pitchOffset) * verticalExaggeration;
    const rightOffset = (data.rightTheta1 - pitchOffset) * verticalExaggeration;
    const scaledLeftTheta2 = data.leftTheta2 * horizontalExaggeration;
    const scaledRightTheta2 = data.rightTheta2 * horizontalExaggeration;
    window.electronAPI.sendOscFourEyeData(
      leftOffset,
      scaledLeftTheta2,
      rightOffset,
      scaledRightTheta2
    );
  }

  /**
   * Sends eye closed amount for native eye tracking.
   * 
   * @param openness - The unscaled openness value computed from this client
   * 0=shut 0.75=normal 1=wide.
   * @param neutralValue The value of (1-openness) which should be treated as normally open.
   */
  static sendNativeEyeOpenness(openness: number, neutralValue: number) {
    // Invert openness: 0 becomes 1, 1 becomes 0.
    const invertedOpenness = 1 - openness;
    let eyesClosedValue: number;
  
    // Interpolate based on the inverted openness.
    if (invertedOpenness <= 0.25) {
      // For values between 0 and 0.25, interpolate from 0 to neutralValue.
      eyesClosedValue = neutralValue * (invertedOpenness / 0.25);
    } else {
      // For values between 0.25 and 1, interpolate from neutralValue to 1.
      eyesClosedValue =
        neutralValue +
        (1 - neutralValue) * ((invertedOpenness - 0.25) / 0.75);
    }
  
    // Use the static clamp method to ensure eyesClosedValue is within [0, 1]
    eyesClosedValue = OscSenderUtils.clamp(eyesClosedValue, 0, 1);
  
    window.electronAPI.sendOscEyesClosedAmount(eyesClosedValue);
  }
  


  /* ====================== VRCFaceTracking V1 ====================== */

  /**
   * Sends combined pitch and yaw data for VRCFaceTracking V1.
   *
   * Normalizes the theta values, computes an offset based on the pitch offset,
   * clamps the results between -1 and 1, and sends them via OSC to pre-defined endpoints.
   *
   * @param data - An object containing raw theta1 and theta2 values.
   * @param pitchOffset - The pitch offset to apply.
   * @param verticalExaggeration - Vertical scaling factor.
   * @param horizontalExaggeration - Horizontal scaling factor.
   */
  static sendVrcftV1CombinedPitchYaw(
    data: { theta1: number; theta2: number },
    pitchOffset: number,
    verticalExaggeration: number,
    horizontalExaggeration: number
  ) {
    const normTheta1 = NormalizationUtils.normalizeTheta1(data.theta1);
    const normTheta2 = NormalizationUtils.normalizeTheta2(data.theta2);

    const offsetFraction = OscSenderUtils.calculateOffsetFraction(pitchOffset);
    const offsetNormTheta1 = OscSenderUtils.scaleOffsetAndClamp(normTheta1, offsetFraction, verticalExaggeration);
    const scaledTheta2 = OscSenderUtils.scaleAndClamp(normTheta2, horizontalExaggeration);

    window.electronAPI.sendOscFloatParam('/avatar/parameters/LeftEyeX', scaledTheta2);
    window.electronAPI.sendOscFloatParam('/avatar/parameters/RightEyeX', scaledTheta2);
    window.electronAPI.sendOscFloatParam('/avatar/parameters/EyesY', -1 * offsetNormTheta1);
  }

  /**
   * Sends independent pitch and yaw data for VRCFaceTracking V1.
   *
   * Assumes left and right theta1 values are similar; normalizes and scales each eye's data,
   * then sends the values via OSC.
   *
   * @param data - An object containing raw left and right theta values.
   * @param pitchOffset - The pitch offset to apply.
   * @param verticalExaggeration - Vertical scaling factor.
   * @param horizontalExaggeration - Horizontal scaling factor.
   */
  static sendVrcftV1IndependentPitchYaw(
    data: {
      leftTheta1: number;
      leftTheta2: number;
      rightTheta1: number;
      rightTheta2: number;
    },
    pitchOffset: number,
    verticalExaggeration: number,
    horizontalExaggeration: number
  ) {
    const normLeftTheta1 = NormalizationUtils.normalizeTheta1(data.leftTheta1);
    const normLeftTheta2 = NormalizationUtils.normalizeTheta2(data.leftTheta2);
    const normRightTheta2 = NormalizationUtils.normalizeTheta2(data.rightTheta2);

    const offsetFraction = OscSenderUtils.calculateOffsetFraction(pitchOffset);
    const leftOffset = OscSenderUtils.scaleOffsetAndClamp(normLeftTheta1, offsetFraction, verticalExaggeration);
    const scaledLeftTheta2 = OscSenderUtils.scaleAndClamp(normLeftTheta2, horizontalExaggeration);
    const scaledRightTheta2 = OscSenderUtils.scaleAndClamp(normRightTheta2, horizontalExaggeration);

    window.electronAPI.sendOscFloatParam('/avatar/parameters/LeftEyeX', scaledLeftTheta2);
    window.electronAPI.sendOscFloatParam('/avatar/parameters/RightEyeX', scaledRightTheta2);
    window.electronAPI.sendOscFloatParam('/avatar/parameters/EyesY', -1 * leftOffset);
  }

  /**
   * Sends combined openness data for VRCFaceTracking V1.
   *
   * @param openness - The openness value.
   */
  static sendVrcftV1CombinedOpenness(openness: number) {
    window.electronAPI.sendOscFloatParam('/avatar/parameters/CombinedEyeLid', openness);
  }

  /**
   * Sends independent openness data for VRCFaceTracking V1.
   *
   * @param data - An object containing left and right openness values.
   */
  static sendVrcftV1IndependentOpenness(
    data: { leftOpenness: number; rightOpenness: number }
  ) {
    window.electronAPI.sendOscFloatParam('/avatar/parameters/LeftEyeLid', data.leftOpenness);
    window.electronAPI.sendOscFloatParam('/avatar/parameters/RightEyeLid', data.rightOpenness);
  }

  /* ====================== VRCFaceTracking V2 ====================== */

  /**
   * Helper function to build the full OSC prefix for VRCFaceTracking V2.
   *
   * Removes any leading or trailing slashes from the provided prefix and constructs
   * a full OSC path. If no prefix is provided, a default path is used.
   *
   * @param oscPrefix - The base OSC prefix.
   * @returns The full OSC prefix.
   */
  private static getVrcftV2Prefix(oscPrefix: string): string {
    let prefix = oscPrefix || '';
    // Remove any leading or trailing slashes.
    prefix = prefix.replace(/^\/+|\/+$/g, '');
    // Return the full prefix with proper formatting.
    if (prefix === "") {
      return `/avatar/parameters/v2/`;
    } else {
      return `/avatar/parameters/${prefix}/v2/`;
    }
  }

  /**
   * Sends combined pitch and yaw data for VRCFaceTracking V2.
   *
   * Normalizes theta values, computes the offset based on pitch offset,
   * scales and clamps the results, and sends OSC messages. Depending on the
   * splitOutputY flag, sends separate Y values for left and right eyes.
   *
   * @param data - An object containing raw theta1 and theta2 values.
   * @param pitchOffset - The pitch offset.
   * @param verticalExaggeration - Vertical scaling factor.
   * @param horizontalExaggeration - Horizontal scaling factor.
   * @param oscPrefix - The OSC prefix.
   * @param splitOutputY - If true, sends separate Y values for each eye.
   */
  static sendVrcftV2CombinedPitchYaw(
    data: { theta1: number; theta2: number },
    pitchOffset: number,
    verticalExaggeration: number,
    horizontalExaggeration: number,
    oscPrefix: string,
    splitOutputY: boolean
  ) {
    const normTheta1 = NormalizationUtils.normalizeTheta1(data.theta1);
    const normTheta2 = NormalizationUtils.normalizeTheta2(data.theta2);
    
    const offsetFraction = OscSenderUtils.calculateOffsetFraction(pitchOffset);
    const offsetNormTheta1 = OscSenderUtils.scaleOffsetAndClamp(normTheta1, offsetFraction, verticalExaggeration);
    const scaledTheta2 = OscSenderUtils.scaleAndClamp(normTheta2, horizontalExaggeration);

    const prefix = OscSenderUtils.getVrcftV2Prefix(oscPrefix);
    if (splitOutputY) {
      window.electronAPI.sendOscFloatParam(prefix + 'EyeLeftX', scaledTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeLeftY', -1 * offsetNormTheta1);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeRightX', scaledTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeRightY', -1 * offsetNormTheta1);
    } else {
      window.electronAPI.sendOscFloatParam(prefix + 'EyeLeftX', scaledTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeRightX', scaledTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeY', -1 * offsetNormTheta1);
    }
  }

  /**
   * Sends independent pitch and yaw data for VRCFaceTracking V2.
   *
   * Processes left and right eye theta values separately: normalizes, applies pitch offsets,
   * scales, clamps, and sends the resulting OSC messages. If splitOutputY is true, sends
   * separate Y values; otherwise, a single Y value is sent.
   *
   * @param data - An object containing raw left and right theta values.
   * @param pitchOffset - The pitch offset.
   * @param verticalExaggeration - Vertical scaling factor.
   * @param horizontalExaggeration - Horizontal scaling factor.
   * @param oscPrefix - The OSC prefix.
   * @param splitOutputY - Whether to send separate Y values.
   */
  static sendVrcftV2IndependentPitchYaw(
    data: { leftTheta1: number; leftTheta2: number; rightTheta1: number; rightTheta2: number },
    pitchOffset: number,
    verticalExaggeration: number,
    horizontalExaggeration: number,
    oscPrefix: string,
    splitOutputY: boolean
  ) {
    const normLeftTheta1 = NormalizationUtils.normalizeTheta1(data.leftTheta1);
    const normRightTheta1 = NormalizationUtils.normalizeTheta1(data.rightTheta1);
    const normLeftTheta2 = NormalizationUtils.normalizeTheta2(data.leftTheta2);
    const normRightTheta2 = NormalizationUtils.normalizeTheta2(data.rightTheta2);

    const offsetFraction = OscSenderUtils.calculateOffsetFraction(pitchOffset);
    const leftOffset = OscSenderUtils.scaleOffsetAndClamp(normLeftTheta1, offsetFraction, verticalExaggeration);
    const rightOffset = OscSenderUtils.scaleOffsetAndClamp(normRightTheta1, offsetFraction, verticalExaggeration);
    const scaledLeftTheta2 = OscSenderUtils.scaleAndClamp(normLeftTheta2, horizontalExaggeration);
    const scaledRightTheta2 = OscSenderUtils.scaleAndClamp(normRightTheta2, horizontalExaggeration);

    const prefix = OscSenderUtils.getVrcftV2Prefix(oscPrefix);
    if (splitOutputY) {
      window.electronAPI.sendOscFloatParam(prefix + 'EyeLeftX', scaledLeftTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeRightX', scaledRightTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeLeftY', -1 * leftOffset);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeRightY', -1 * rightOffset);
    } else {
      window.electronAPI.sendOscFloatParam(prefix + 'EyeLeftX', scaledLeftTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeRightX', scaledRightTheta2);
      window.electronAPI.sendOscFloatParam(prefix + 'EyeY', -1 * leftOffset);
    }
  }

  /**
   * Sends combined openness data for VRCFaceTracking V2.
   *
   * @param openness - The openness value.
   * @param oscPrefix - The OSC prefix.
   */
  static sendVrcftV2CombinedOpenness(
    openness: number,
    oscPrefix: string
  ) {
    const prefix = OscSenderUtils.getVrcftV2Prefix(oscPrefix);
    window.electronAPI.sendOscFloatParam(prefix + 'EyeLidLeft', openness);
    window.electronAPI.sendOscFloatParam(prefix + 'EyeLidRight', openness);
  }

  /**
   * Sends independent openness data for VRCFaceTracking V2.
   *
   * @param data - An object containing left and right openness values.
   * @param oscPrefix - The OSC prefix.
   */
  static sendVrcftV2IndependentOpenness(
    data: { leftOpenness: number; rightOpenness: number },
    oscPrefix: string
  ) {
    const prefix = OscSenderUtils.getVrcftV2Prefix(oscPrefix);
    window.electronAPI.sendOscFloatParam(prefix + 'EyeLidLeft', data.leftOpenness);
    window.electronAPI.sendOscFloatParam(prefix + 'EyeLidRight', data.rightOpenness);
  }
}
