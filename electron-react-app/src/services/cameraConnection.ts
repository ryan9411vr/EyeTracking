// src/services/cameraConnection.ts

/**
 * Camera Connection Service
 *
 * This module manages MJPEG camera connections by fetching and parsing MJPEG streams.
 * It processes incoming JPEG frames via web workers and updates the application state
 * (using a Redux store) to reflect the online/offline status of the cameras. Each connection
 * is associated with either the left or right eye stream. The service monitors for stale frames
 * using an offline timeout, and it exposes a `close` method to allow external termination of the stream.
 *
 * Key behaviors:
 * - Fetches and continuously reads an MJPEG stream from a given URL.
 * - Uses workers to process JPEG frames and dispatches updates to the store.
 * - Implements a timeout mechanism to mark the connection as offline if no new frames arrive.
 * - Does not perform reconnection on errors; it simply closes the connection and calls an optional error callback.
 */

import store from '../store';
import { setCameraFrame } from '../slices/statusSlice';

/**
 * Concatenates two Uint8Array instances.
 *
 * @param a - First Uint8Array.
 * @param b - Second Uint8Array.
 * @returns A new Uint8Array combining the contents of a and b.
 */
function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const concatenated = new Uint8Array(a.length + b.length);
  concatenated.set(a, 0);
  concatenated.set(b, a.length);
  return concatenated;
}

/**
 * Searches for a sequence (subarray) within a Uint8Array buffer.
 *
 * @param buffer - The buffer to search within.
 * @param seq - The sequence to locate.
 * @returns The starting index of the sequence if found, or -1 if not.
 */
function findSequence(buffer: Uint8Array, seq: Uint8Array): number {
  for (let i = 0; i <= buffer.length - seq.length; i++) {
    let found = true;
    for (let j = 0; j < seq.length; j++) {
      if (buffer[i + j] !== seq[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

/**
 * Interface representing a camera connection.
 * Provides a method to close the connection externally.
 */
export interface CameraConnection {
  close: () => void;
}

/**
 * Options for establishing a single MJPEG connection.
 */
export interface MJPEGConnectionOptions {
  side: 'leftEye' | 'rightEye';
  streamUrl: string;
  onError?: (error: any) => void; // Callback for handling fatal errors
}

/**
 * Options for establishing a COM-based MJPEG connection.
 */
export interface MJPEGCOMConnectionOptions {
  side: 'leftEye' | 'rightEye';
  port: string; // The COM port string (e.g., "COM3")
  onError?: (error: any) => void;
}

// Create worker instances for processing image data for each eye.
// Adjust the file paths based on your project structure.
const imageProcessorWorkerLeft = new Worker(new URL('../workers/imageProcessor.worker.js', import.meta.url));
const imageProcessorWorkerRight = new Worker(new URL('../workers/imageProcessor.worker.js', import.meta.url));

/**
 * Creates a single MJPEG connection to fetch, process, and dispatch camera frames.
 *
 * This function:
 * - Initiates an MJPEG stream fetch and continuously reads the stream.
 * - Parses the stream for JPEG frames using defined boundaries.
 * - Processes each frame using a dedicated web worker.
 * - Dispatches the processed frame to update the camera status in the Redux store.
 * - Implements a timeout mechanism to mark the camera as offline if no new frame is received.
 * - Exposes a close method to allow external cancellation of the connection.
 *
 * @param options - Connection options including the stream URL, camera side, and an optional error callback.
 * @returns An object with a `close` method to terminate the connection.
 */
export function createMJPEGWIFIConnection({
  side,
  streamUrl,
  onError
}: MJPEGConnectionOptions): CameraConnection {
  // Flag indicating if the connection has been cancelled.
  const cancelFlag = { cancelled: false };
  
  // MJPEG boundary string and header terminator used to parse the stream.
  const boundaryStr = "\r\n--123456789000000000000987654321\r\n";
  const boundary = new TextEncoder().encode(boundaryStr);
  const headerTerminator = new TextEncoder().encode("\r\n\r\n");
  
  let offlineTimeout: ReturnType<typeof setTimeout> | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let abortController: AbortController | null = null;

  /**
   * Closes the MJPEG connection.
   *
   * Marks the connection as cancelled, clears any pending timeouts,
   * aborts the fetch, and cancels the stream reader.
   */
  function close() {
    cancelFlag.cancelled = true;
    if (offlineTimeout) {
      clearTimeout(offlineTimeout);
      offlineTimeout = null;
    }
    abortController?.abort();
    if (reader) {
      reader.cancel().catch(err => {
        // Suppress abort errors from reader cancellation.
        if (err?.name !== 'AbortError') {
          console.error("Error cancelling reader:", err);
        }
      });
    }
  }

  /**
   * Resets the offline timeout.
   *
   * If no new frame is received within the timeout period (currently 1000ms),
   * the connection is marked offline, the store is updated, and the connection is closed.
   */
  const resetOfflineTimeout = () => {
    if (offlineTimeout) clearTimeout(offlineTimeout);
    offlineTimeout = setTimeout(() => {
      if (!cancelFlag.cancelled) {
        const currentState = store.getState();
        const cameraData = currentState.status.imageData[side];
        if (cameraData.status !== 'offline') {
          store.dispatch(
            setCameraFrame({
              side,
              frame: cameraData.frame,
              timestamp: cameraData.timestamp || Date.now(),
              status: 'offline'
            })
          );
        }
        close();
        // Notify the creator that the connection is closing due to a stale frame.
        if (onError) {
          onError(new Error("Stale frame: connection closed due to no new frames"));
        }
      }
    }, 1000);
  };

  // Set the initial offline timeout.
  resetOfflineTimeout();

  // Configure the appropriate worker message handler based on the camera side.
  if (side === 'leftEye') {
    imageProcessorWorkerLeft.onmessage = (e: MessageEvent) => {
      const { dataUrl, error } = e.data;
      if (cancelFlag.cancelled) return;
      if (error) {
        console.error("Worker error:", error);
        store.dispatch(
          setCameraFrame({
            side,
            frame: '',
            timestamp: Date.now(),
            status: 'offline'
          })
        );
      } else if (dataUrl) {
        store.dispatch(
          setCameraFrame({
            side,
            frame: dataUrl,
            timestamp: Date.now(),
            status: 'online'
          })
        );
        resetOfflineTimeout();
      }
    };
  } else {
    imageProcessorWorkerRight.onmessage = (e: MessageEvent) => {
      const { dataUrl, error } = e.data;
      if (cancelFlag.cancelled) return;
      if (error) {
        console.error("Worker error:", error);
        store.dispatch(
          setCameraFrame({
            side,
            frame: '',
            timestamp: Date.now(),
            status: 'offline'
          })
        );
      } else if (dataUrl) {
        store.dispatch(
          setCameraFrame({
            side,
            frame: dataUrl,
            timestamp: Date.now(),
            status: 'online'
          })
        );
        resetOfflineTimeout();
      }
    };
  }

  /**
   * Processes a single JPEG frame extracted from the MJPEG stream.
   *
   * The frame is transferred to the appropriate worker for processing.
   *
   * @param imageData - The raw JPEG data as a Uint8Array.
   */
  async function processFrame(imageData: Uint8Array) {
    if (cancelFlag.cancelled) {
      console.log("processFrame: Connection cancelled");
      return;
    }
    // Transfer the ArrayBuffer to the worker for efficient processing.
    if (side === 'leftEye') {
      imageProcessorWorkerLeft.postMessage(
        { jpegBuffer: imageData.buffer },
        [imageData.buffer]
      );
    } else {
      imageProcessorWorkerRight.postMessage(
        { jpegBuffer: imageData.buffer },
        [imageData.buffer]
      );
    }
  }

  // Main loop: fetch and parse the MJPEG stream.
  (async () => {
    try {
      abortController = new AbortController();

      // Set a 5-second timeout for the initial fetch.
      const timeoutId = setTimeout(() => {
        abortController?.abort();
      }, 5000);

      const response = await fetch(streamUrl, {
        mode: 'cors',
        cache: 'no-store',
        signal: abortController.signal
      });
      clearTimeout(timeoutId);

      // Exit if the connection was cancelled.
      if (cancelFlag.cancelled) return;

      if (!response.body) throw new Error('No response body');
      reader = response.body.getReader();

      let buffer = new Uint8Array(0);
      while (true) {
        if (cancelFlag.cancelled) {
          console.log("canceled");
          await reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) {
          console.log("done");
          break;
        }
        buffer = concatUint8Arrays(buffer, value!);

        // Look for the MJPEG boundary and process each frame.
        let boundaryIndex = findSequence(buffer, boundary);
        while (boundaryIndex !== -1) {
          const part = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + boundary.length);
          const headerEnd = findSequence(part, headerTerminator);
          if (headerEnd !== -1) {
            const jpegData = part.slice(headerEnd + headerTerminator.length);
            if (jpegData.length > 0) {
              processFrame(jpegData).catch(err => {
                if (err?.name !== 'AbortError') {
                  console.error(`Error processing frame for ${side}:`, err);
                }
              });
            }
          }
          boundaryIndex = findSequence(buffer, boundary);
        }
      }
    } catch (error: any) {
      if (!cancelFlag.cancelled) {
        if (error?.name !== 'AbortError') {
          console.error(`Error in ${side} MJPEG stream:`, error);
        }
        store.dispatch(
          setCameraFrame({
            side,
            frame: '',
            timestamp: Date.now(),
            status: 'offline'
          })
        );
        onError?.(error);
      }
    } finally {
      if (offlineTimeout) clearTimeout(offlineTimeout);
    }
  })();

  return { close };
}

// Listen for camera frame updates via the preload-exposed API.
window.comCameraAPI.onFrameUpdate(
  (
    _event: Electron.IpcRendererEvent,
    payload: {
      side: 'leftEye' | 'rightEye';
      frame: string;
      timestamp: number;
      status: 'online' | 'offline';
    }
  ) => {
    store.dispatch(
      setCameraFrame({
        side: payload.side,
        frame: payload.frame,
        timestamp: payload.timestamp,
        status: payload.status,
      })
    );
  }
);

/**
 * Options for establishing a COM-based MJPEG connection.
 */
export interface MJPEGCOMConnectionOptions {
  side: 'leftEye' | 'rightEye';
  port: string; // COM port string, e.g., "COM3"
  onError?: (error: any) => void;
}

/**
 * Creates a COM-based MJPEG connection via IPC.
 *
 * This function sends an IPC message to the Electron main process to start the COM connection.
 * It returns an object with a `close` method that, when invoked, instructs the main process to stop
 * the COM connection.
 *
 * @param options - Connection options including the COM port, camera side
 * @returns An object with a `close` method to terminate the COM connection.
 */
export function createMJPEGCOMConnection(
  options: MJPEGCOMConnectionOptions
): CameraConnection {
  // Destructure and omit the onError property.
  const { side, port } = options;
  
  // Send only cloneable properties via IPC.
  window.comCameraAPI.startConnection({ side, port });

  return {
    close: () => {
      window.comCameraAPI.stopConnection(side);
    },
  };
}