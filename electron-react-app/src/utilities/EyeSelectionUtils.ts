// src/utilities/eyeSelectionUtils.ts

import store from '../store';

/**
 * Utility class for selecting eye tracking values based on the online status of each eye.
 *
 * These functions retrieve eye-tracking data from a Redux store and choose which values to return
 * based on whether the left and/or right eyes are considered "online". The intent is to ensure that,
 * in cases where one eye is offline or the independent eye predictions conflict, a reliable fallback
 * is used for display or further processing.
 *
 * The functions cover both independent and combined eye predictions for theta (angular) values as well
 * as openness values.
 */
export class EyeSelectionUtils {
  /**
   * Selects independent eye theta values.
   *
   * This method returns an object containing four theta values: leftTheta1, leftTheta2, rightTheta1,
   * and rightTheta2. When both eyes are online, it further checks if the independent theta2 values are
   * converging. If they are diverging (i.e. leftTheta2 is less than rightTheta2), the method falls back to
   * combined eye tracking values to avoid inconsistent outputs. If only one eye is online, the method duplicates
   * the available eye's values for both eyes.
   *
   * @returns An object with the properties: leftTheta1, leftTheta2, rightTheta1, and rightTheta2.
   */
  static chooseIndependentEyeThetas(): {
    leftTheta1: number;
    leftTheta2: number;
    rightTheta1: number;
    rightTheta2: number;
  } {
    const state = store.getState();
    const leftOnline = state.status.imageData.leftEye.status === 'online';
    const rightOnline = state.status.imageData.rightEye.status === 'online';
    const status = state.status;

    if (leftOnline && rightOnline) {
      // When both eyes are online, verify that the independent theta2 values converge.
      // If they are diverging (leftTheta2 < rightTheta2), then the values are deemed unreliable.
      // Fallback to combined eye tracking values.
      if (status.latentsLeft.theta2 - status.latentsRight.theta2 < 0) {
        return {
          leftTheta1: status.latents.theta1,
          leftTheta2: status.latents.theta2,
          rightTheta1: status.latents.theta1,
          rightTheta2: status.latents.theta2,
        };
      }
      return {
        leftTheta1: status.latents.theta1,
        leftTheta2: status.latentsLeft.theta2,
        rightTheta1: status.latents.theta1,
        rightTheta2: status.latentsRight.theta2,
      };
    } else if (leftOnline) {
      // Only left eye is online; duplicate its theta values for the right eye.
      return {
        leftTheta1: status.latentsLeft.theta1,
        leftTheta2: status.latentsLeft.theta2,
        rightTheta1: status.latentsLeft.theta1,
        rightTheta2: status.latentsLeft.theta2,
      };
    } else if (rightOnline) {
      // Only right eye is online; duplicate its theta values for the left eye.
      return {
        leftTheta1: status.latentsRight.theta1,
        leftTheta2: status.latentsRight.theta2,
        rightTheta1: status.latentsRight.theta1,
        rightTheta2: status.latentsRight.theta2,
      };
    } else {
      // Neither eye is online; return default zero values.
      return {
        leftTheta1: 0,
        leftTheta2: 0,
        rightTheta1: 0,
        rightTheta2: 0,
      };
    }
  }

  /**
   * Selects independent eye openness values.
   *
   * This method returns an object containing two openness values: leftOpenness and rightOpenness.
   * When both eyes are online, it returns each eye's individual openness value. If only one eye is online,
   * the method duplicates the available value for both eyes. If neither eye is online, it returns zero for both.
   *
   * @returns An object with the properties: leftOpenness and rightOpenness.
   */
  static chooseIndependentEyeOpenness(): {
    leftOpenness: number;
    rightOpenness: number;
  } {
    const state = store.getState();
    const leftOnline = state.status.imageData.leftEye.status === 'online';
    const rightOnline = state.status.imageData.rightEye.status === 'online';
    const status = state.status;

    if (leftOnline && rightOnline) {
      return {
        leftOpenness: status.opennessData.opennessLeft,
        rightOpenness: status.opennessData.opennessRight,
      };
    } else if (leftOnline) {
      return {
        leftOpenness: status.opennessData.opennessLeft,
        rightOpenness: status.opennessData.opennessLeft,
      };
    } else if (rightOnline) {
      return {
        leftOpenness: status.opennessData.opennessRight,
        rightOpenness: status.opennessData.opennessRight,
      };
    } else {
      return {
        leftOpenness: 0,
        rightOpenness: 0,
      };
    }
  }

  /**
   * Selects combined eye theta values.
   *
   * This method returns an object containing two theta values: theta1 and theta2. When both eyes are online,
   * it returns the combined eye tracking values. If only one eye is online, it returns that eye's theta values.
   * If neither eye is online, it defaults to zero.
   *
   * @returns An object with the properties: theta1 and theta2.
   */
  static chooseCombinedEyeThetas(): { theta1: number; theta2: number } {
    const state = store.getState();
    const leftOnline = state.status.imageData.leftEye.status === 'online';
    const rightOnline = state.status.imageData.rightEye.status === 'online';
    const status = state.status;

    if (leftOnline && rightOnline) {
      return {
        theta1: status.latents.theta1,
        theta2: status.latents.theta2,
      };
    } else if (leftOnline) {
      return {
        theta1: status.latentsLeft.theta1,
        theta2: status.latentsLeft.theta2,
      };
    } else if (rightOnline) {
      return {
        theta1: status.latentsRight.theta1,
        theta2: status.latentsRight.theta2,
      };
    } else {
      return { theta1: 0, theta2: 0 };
    }
  }

  /**
   * Selects a combined eye openness value.
   *
   * This method returns a single openness value. When both eyes are online, it returns the combined
   * openness value from the tracking data. If only one eye is online, it returns that eye's openness value.
   * If neither eye is online, it defaults to zero.
   *
   * @returns The combined or single eye openness value.
   */
  static chooseCombinedEyeOpenness(): number {
    const state = store.getState();
    const leftOnline = state.status.imageData.leftEye.status === 'online';
    const rightOnline = state.status.imageData.rightEye.status === 'online';
    const status = state.status;

    if (leftOnline && rightOnline) {
      return status.opennessData.opennessCombined;
    } else if (leftOnline) {
      return status.opennessData.opennessLeft;
    } else if (rightOnline) {
      return status.opennessData.opennessRight;
    } else {
      return 0;
    }
  }
}
