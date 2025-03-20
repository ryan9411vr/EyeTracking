// src/services/cameraService.ts

/**
 * Camera Service Module
 *
 * This module manages MJPEG camera connections for both the left and right eye. It automatically
 * establishes connections based on the current configuration, monitors for connection failures,
 * and attempts reconnection if necessary. The service also listens for configuration changes in the Redux
 * store to update or reinitialize connections.
 */
import store from '../store';
import { createMJPEGWIFIConnection, CameraConnection, createMJPEGCOMConnection } from './cameraConnection';
import { determinePortType } from '../utilities/validation';

// Global state for current connections and configuration.
let leftConn: CameraConnection | null = null;
let rightConn: CameraConnection | null = null;
let currentLeftAddress: string | null = null;
let currentRightAddress: string | null = null;
let shuttingDown = false;

/**
 * Establishes a camera connection with automatic reconnection logic.
 *
 * Attempts to create a connection for the specified camera side ('leftEye' or 'rightEye') using
 * the provided IP/port configuration. If an error occurs, the function waits 2 seconds before retrying,
 * as long as the configuration remains unchanged, the service is not shutting down, and the forced offline
 * flag for the specified side is false.
 *
 * @param side - The camera side ('leftEye' or 'rightEye').
 * @param ipPort - The IP and port configuration string for the camera stream.
 * @returns An object with a `close` method to terminate the connection.
 */
function connectWithReattempt(
  side: 'leftEye' | 'rightEye',
  ipPort: string
): CameraConnection {
  let activeConnection: CameraConnection | null = null;
  let closed = false;

  const attemptConnection = () => {
    if (closed || shuttingDown) return;

    // Check forced offline flag before attempting connection.
    const configState = store.getState().config;
    if (side === 'leftEye' && configState.leftEyeForcedOffline) {
      console.log("Camera Service: leftEye forced offline, not attempting connection.");
      return;
    }
    if (side === 'rightEye' && configState.rightEyeForcedOffline) {
      console.log("Camera Service: rightEye forced offline, not attempting connection.");
      return;
    }

    // Determine the type of port.
    const portType = determinePortType(ipPort);
    if (portType === 'IP') {
      activeConnection = createMJPEGWIFIConnection({
        side,
        streamUrl: `http://${ipPort}/`,
        onError: () => {
          // Wait 2 seconds before retrying the connection.
          setTimeout(() => {
            const currentConfig = store.getState().config;
            if (
              !closed &&
              !shuttingDown &&
              currentConfig[side] === ipPort &&
              (side === 'leftEye' ? !currentConfig.leftEyeForcedOffline : !currentConfig.rightEyeForcedOffline)
            ) {
              attemptConnection();
            }
          }, 2000);
        }
      });
    } else if (portType === 'COM') {
      activeConnection = createMJPEGCOMConnection({
        side,
        port: ipPort,
        onError: () => {
          // Wait 2 seconds before retrying the connection.
          setTimeout(() => {
            const currentConfig = store.getState().config;
            if (
              !closed &&
              !shuttingDown &&
              currentConfig[side] === ipPort &&
              (side === 'leftEye' ? !currentConfig.leftEyeForcedOffline : !currentConfig.rightEyeForcedOffline)
            ) {
              attemptConnection();
            }
          }, 2000);
        }
      });
    } else {
      console.error(`Camera Service: Invalid port type provided: ${ipPort}`);
      return;
    }
  };

  // Initiate the first connection attempt.
  attemptConnection();

  return {
    close: () => {
      closed = true;
      activeConnection?.close();
    }
  };
}

/**
 * Starts the camera service for both eye streams.
 *
 * Reads the current configuration from the Redux store and establishes connections for each camera stream
 * if they are not forced offline. Also subscribes to configuration changes to update or reinitialize connections
 * when relevant settings change.
 */
export function startCameraService() {
  const state = store.getState();
  currentLeftAddress = state.config.leftEye;
  currentRightAddress = state.config.rightEye;

  // Establish connections if not forced offline.
  if (currentLeftAddress && !state.config.leftEyeForcedOffline) {
    leftConn = connectWithReattempt('leftEye', currentLeftAddress);
  }
  if (currentRightAddress && !state.config.rightEyeForcedOffline) {
    rightConn = connectWithReattempt('rightEye', currentRightAddress);
  }

  // Subscribe to configuration changes.
  store.subscribe(() => {
    const newState = store.getState();
    const newLeft = newState.config.leftEye;
    const newRight = newState.config.rightEye;
    const leftForced = newState.config.leftEyeForcedOffline;
    const rightForced = newState.config.rightEyeForcedOffline;

    // Handle left eye updates.
    if (leftForced) {
      if (leftConn) {
        console.log("Camera Service: leftEye forced offline - closing active connection.");
        leftConn.close();
        leftConn = null;
      }
    } else {
      if (newLeft !== currentLeftAddress) {
        currentLeftAddress = newLeft;
        if (leftConn) {
          leftConn.close();
          leftConn = null;
        }
        if (newLeft && !leftForced) {
          leftConn = connectWithReattempt('leftEye', newLeft);
        }
      }
      if (!leftConn && newLeft && !leftForced) {
        leftConn = connectWithReattempt('leftEye', newLeft);
      }
    }

    // Handle right eye updates.
    if (rightForced) {
      if (rightConn) {
        console.log("Camera Service: rightEye forced offline - closing active connection.");
        rightConn.close();
        rightConn = null;
      }
    } else {
      if (newRight !== currentRightAddress) {
        currentRightAddress = newRight;
        if (rightConn) {
          rightConn.close();
          rightConn = null;
        }
        if (newRight && !rightForced) {
          rightConn = connectWithReattempt('rightEye', newRight);
        }
      }
      if (!rightConn && newRight && !rightForced) {
        rightConn = connectWithReattempt('rightEye', newRight);
      }
    }
  });
}
