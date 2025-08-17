// src/utilities/KalmanFilterManager.ts

import { AdaptiveKalmanFilter } from './AdaptiveKalmanFilter';
import { ConfigState } from '../slices/configSlice';

/**
 * Represents the configuration parameters used to initialize Kalman filters.
 * This includes thresholds for both general angle filtering and openness‑specific filtering.
 */
interface KalmanConfig {
  measurementNoise: number;
  kalmanQLow: number;
  kalmanQHigh: number;
  kalmanThreshold: number; // Gaze
  kalmanThresholdOpenness: number;
}

/**
 * Represents a pair of AdaptiveKalmanFilters for filtering two angular measurements.
 * Also stores the last configuration used for initializing these filters.
 */
interface ModelFilters {
  filter1: AdaptiveKalmanFilter | null;
  filter2: AdaptiveKalmanFilter | null;
  lastKalmanConfig: KalmanConfig | null;
}

/**
 * Represents a single AdaptiveKalmanFilter for filtering an openness measurement,
 * along with the last configuration used for its initialization.
 */
interface OpennessFilter {
  filter: AdaptiveKalmanFilter | null;
  lastKalmanConfig: KalmanConfig | null;
}

/**
 * Manages multiple AdaptiveKalmanFilter instances for different models.
 *
 * This manager maintains:
 * - A map for two‑angle filtering (e.g. for pitch and yaw), where each model is assigned a pair of filters.
 * - A separate map for openness filtering, where each model is assigned a single filter.
 *
 * The filters are re‑initialized if they are uninitialized or if the configuration parameters change,
 * ensuring that the filtering always uses the most current settings.
 */
class KalmanFilterManager {
  private filterMap: Record<string, ModelFilters> = {};
  private opennessFilterMap: Record<string, OpennessFilter> = {};

  /**
   * Filters two angular measurements (angle1 and angle2) for the specified model using a pair
   * of AdaptiveKalmanFilters. If the filters are uninitialized or if the Kalman configuration has changed,
   * new filters are created using the current configuration.
   *
   * @param modelId - A unique identifier for the model (e.g., 'combinedTheta', 'anotherModel').
   * @param angle1 - Raw angular prediction #1 from the model.
   * @param angle2 - Raw angular prediction #2 from the model.
   * @param config - The current Kalman filter configuration from the Redux store.
   * @param trustworthiness - A trust value for the measurement used during the filter update.
   * @returns A tuple containing the filtered angle values: [filteredAngle1, filteredAngle2].
   */
  public filterTwoAngles(
    modelId: string,
    angle1: number,
    angle2: number,
    config: ConfigState,
    trustworthiness: number
  ): [number, number] {
    // Initialize filters for this model if they do not already exist.
    if (!this.filterMap[modelId]) {
      this.filterMap[modelId] = {
        filter1: null,
        filter2: null,
        lastKalmanConfig: null,
      };
    }

    const { filter1, filter2, lastKalmanConfig } = this.filterMap[modelId];

    // Check if the configuration has changed compared to the last initialization.
    const configChanged =
      !lastKalmanConfig ||
      config.measurementNoise !== lastKalmanConfig.measurementNoise ||
      config.kalmanQLow !== lastKalmanConfig.kalmanQLow ||
      config.kalmanQHigh !== lastKalmanConfig.kalmanQHigh ||
      config.kalmanThreshold !== lastKalmanConfig.kalmanThreshold;

    const filtersUninitialized = !filter1 || !filter2;

    // Reinitialize filters if needed.
    if (filtersUninitialized || configChanged) {
      const newFilter1 = new AdaptiveKalmanFilter(
        angle1,
        1, // initial error covariance
        config.measurementNoise,
        config.kalmanQLow,
        config.kalmanQHigh,
        config.kalmanThreshold
      );
      const newFilter2 = new AdaptiveKalmanFilter(
        angle2,
        1,
        config.measurementNoise,
        config.kalmanQLow,
        config.kalmanQHigh,
        config.kalmanThreshold
      );

      this.filterMap[modelId] = {
        filter1: newFilter1,
        filter2: newFilter2,
        lastKalmanConfig: {
          measurementNoise: config.measurementNoise,
          kalmanQLow: config.kalmanQLow,
          kalmanQHigh: config.kalmanQHigh,
          kalmanThreshold: config.kalmanThreshold,
          kalmanThresholdOpenness: config.kalmanThresholdOpenness,
        },
      };
    }

    // Update the filters with the new raw measurements.
    const updatedFilter1 = this.filterMap[modelId].filter1!;
    const updatedFilter2 = this.filterMap[modelId].filter2!;
    return [
      updatedFilter1.update(angle1, trustworthiness),
      updatedFilter2.update(angle2, trustworthiness),
    ];
  }

  /**
   * Filters a single openness measurement for the specified model using an AdaptiveKalmanFilter.
   *
   * This method checks if the openness filter is uninitialized or if the configuration parameters
   * (including the openness-specific threshold) have changed. If so, it reinitializes the filter.
   *
   * @param modelId - A unique identifier for the model (e.g., 'opennessCombined', 'anotherModel').
   * @param openness - The raw openness measurement from the model.
   * @param config - The current Kalman filter configuration from the Redux store.
   * @returns The filtered openness value.
   */
  public filterOpenness(
    modelId: string,
    openness: number,
    config: ConfigState
  ): number {
    // Initialize the openness filter for this model if not already present.
    if (!this.opennessFilterMap[modelId]) {
      this.opennessFilterMap[modelId] = {
        filter: null,
        lastKalmanConfig: null,
      };
    }

    const { filter, lastKalmanConfig } = this.opennessFilterMap[modelId];

    // Determine if the configuration has changed.
    const configChanged =
      !lastKalmanConfig ||
      config.measurementNoise !== lastKalmanConfig.measurementNoise ||
      config.kalmanQLow !== lastKalmanConfig.kalmanQLow ||
      config.kalmanQHigh !== lastKalmanConfig.kalmanQHigh ||
      config.kalmanThreshold !== lastKalmanConfig.kalmanThreshold ||
      config.kalmanThresholdOpenness != lastKalmanConfig.kalmanThresholdOpenness;

    // Reinitialize the filter if necessary.
    if (!filter || configChanged) {
      const newFilter = new AdaptiveKalmanFilter(
        openness,
        1, // initial error covariance
        config.measurementNoise,
        config.kalmanQLow,
        config.kalmanQHigh,
        // Use the openness-specific threshold.
        config.kalmanThresholdOpenness
      );
      this.opennessFilterMap[modelId].filter = newFilter;
      this.opennessFilterMap[modelId].lastKalmanConfig = {
        measurementNoise: config.measurementNoise,
        kalmanQLow: config.kalmanQLow,
        kalmanQHigh: config.kalmanQHigh,
        kalmanThreshold: config.kalmanThreshold,
        kalmanThresholdOpenness: config.kalmanThresholdOpenness,
      };
    }

    // Update the filter with the new openness measurement.
    const updatedOpennessFilter = this.opennessFilterMap[modelId].filter!;
    return updatedOpennessFilter.update(openness, 1);
  }
}

// Export a singleton instance of the KalmanFilterManager for use throughout the application.
export default new KalmanFilterManager();
