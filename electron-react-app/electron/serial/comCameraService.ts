// /serial/comCameraService.ts

import { SerialPort } from 'serialport';
import { BrowserWindow } from 'electron';

/**
 * Interface for COM connection options.
 */
export interface COMConnectionOptions {
  side: 'leftEye' | 'rightEye';
  port: string; // COM port string, e.g., "COM3"
  baudRate?: number;
}

/**
 * Interface representing a camera connection.
 * Provides a method to close the connection externally.
 */
export interface CameraConnection {
  close: () => void;
}

/**
 * Creates a COM-based MJPEG connection.
 *
 * This function opens a serial port connection, reads the incoming data stream
 * from the ESP32 (which sends data from an OV2640 camera using a custom header/length format),
 * parses out the JPEG frame, and then sends an IPC message to the browser process
 * with the data URL for the image. It will automatically attempt to reconnect if the connection
 * is lost, and it supports being closed.
 *
 * @param options - Connection options including the COM port, side identifier, and baud rate.
 * @returns An object with a `close` method to terminate the connection.
 */
export function createMJPEGCOMConnection(options: COMConnectionOptions): CameraConnection {
  const { side, port, baudRate = 115200 } = options;

  let serialPort: SerialPort | null = null;
  let isClosed = false;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  // Buffer for accumulating incoming data.
  let buffer = Buffer.alloc(0);

  // Constants matching the headers in SerialManager.cpp:
  const HEADER = Buffer.from([0xFF, 0xA0]);       // ETVR_HEADER
  const HEADER_FRAME = Buffer.from([0xFF, 0xA1]);   // ETVR_HEADER_FRAME
  // Total header length: 2 (HEADER) + 2 (HEADER_FRAME) + 2 (frame length bytes)
  const HEADER_TOTAL_LENGTH = 6;

  /**
   * Sends an IPC message to all renderer windows to update the camera frame and status.
   *
   * @param frameData - A data URL string representing the JPEG image.
   * @param status - The camera status ('online' or 'offline').
   */
  function notifyFrameUpdate(frameData: string, status: 'online' | 'offline'): void {
    const timestamp = Date.now();
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('camera-frame-update', { side, frame: frameData, timestamp, status });
    });
  }

  /**
   * Initiates the serial port connection.
   */
  function connect(): void {
    if (isClosed) return;
    serialPort = new SerialPort({
      path: port,
      baudRate,
      autoOpen: false,
    });

    serialPort.open(err => {
      if (err) {
        console.error(`COM Camera Service: Failed to open port ${port}:`, err);
        scheduleReconnect();
        return;
      }
      console.log(`COM Camera Service: Connected to ${port}`);
      // Clear any old data.
      buffer = Buffer.alloc(0);
      // Set up event listeners.
      serialPort?.on('data', onData);
      serialPort?.on('error', onSerialError);
      serialPort?.on('close', onSerialClose);
    });
  }

  /**
   * Schedules a reconnection attempt after a delay.
   */
  function scheduleReconnect(): void {
    if (isClosed) return;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      connect();
    }, 2000);
  }

  /**
   * Handles serial port errors.
   */
  function onSerialError(err: any): void {
    console.error(`COM Camera Service: Serial error on port ${port}:`, err);
    if (serialPort && serialPort.isOpen) {
      serialPort.close(() => scheduleReconnect());
    } else {
      scheduleReconnect();
    }
  }

  /**
   * Handles the serial port close event.
   */
  function onSerialClose(): void {
    console.log(`COM Camera Service: Port ${port} closed`);
    scheduleReconnect();
  }

  /**
   * Processes incoming serial data.
   *
   * The protocol is as follows:
   * - 2 bytes: HEADER (0xFF, 0xA0)
   * - 2 bytes: HEADER_FRAME (0xFF, 0xA1)
   * - 2 bytes: frame length (little-endian)
   * - [frame length] bytes: JPEG image data
   *
   * When a complete frame is extracted, it is converted to a data URL and sent via IPC.
   */
  function onData(data: Buffer): void {
    // Append the new data to the buffer.
    buffer = Buffer.concat([buffer, data]);

    // Process all complete messages in the buffer.
    while (buffer.length >= HEADER_TOTAL_LENGTH) {
      const headerIndex = buffer.indexOf(HEADER);
      if (headerIndex === -1) {
        // No complete header found.
        // If the last byte might be the start of a header, keep it.
        if (buffer.length > 0 && buffer[buffer.length - 1] === HEADER[0]) {
          buffer = buffer.slice(buffer.length - 1);
        } else {
          buffer = Buffer.alloc(0);
        }
        break; // Wait for more data.
      }
      // Ensure we have enough data after the header.
      if (buffer.length < headerIndex + HEADER_TOTAL_LENGTH) {
        break; // Wait for more data.
      }
      // Validate that the next two bytes match HEADER_FRAME.
      const possibleHeaderFrame = buffer.slice(headerIndex + 2, headerIndex + 4);
      if (!possibleHeaderFrame.equals(HEADER_FRAME)) {
        // Skip invalid header and try again.
        buffer = buffer.slice(headerIndex + 1);
        continue;
      }
      // Read the two length bytes (little-endian).
      const lengthBytes = buffer.slice(headerIndex + 4, headerIndex + 6);
      const frameLength = lengthBytes.readUInt16LE(0);
      // Check if the entire frame is available.
      if (buffer.length < headerIndex + HEADER_TOTAL_LENGTH + frameLength) {
        break; // Wait for the rest of the frame.
      }
      // Extract the JPEG frame.
      const frameData = buffer.slice(headerIndex + HEADER_TOTAL_LENGTH, headerIndex + HEADER_TOTAL_LENGTH + frameLength);
      // Remove processed bytes from the buffer.
      buffer = buffer.slice(headerIndex + HEADER_TOTAL_LENGTH + frameLength);
      // Validate that the frame is a valid JPEG before sending update.
      if (isValidJPEG(frameData)) {
        const dataUrl = `data:image/jpeg;base64,${frameData.toString('base64')}`;
        notifyFrameUpdate(dataUrl, 'online');
      } else {
        console.error("Invalid JPEG frame detected. Skipping frame update.");
      }
    }
  }

  // Start the connection immediately.
  connect();

  return {
    close: () => {
      isClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (serialPort && serialPort.isOpen) {
        serialPort.removeListener('data', onData);
        serialPort.removeListener('error', onSerialError);
        serialPort.removeListener('close', onSerialClose);
        serialPort.close();
      }
    },
  };
}

// Helper function to check if a buffer contains a valid JPEG frame.
// Doesn't check everything but is a small little sanity check.
function isValidJPEG(frameData: Buffer): boolean {
  // A valid JPEG should be at least 4 bytes, start with 0xFFD8, and end with 0xFFD9.
  if (frameData.length < 4) return false;
  return (
    frameData[0] === 0xFF &&
    frameData[1] === 0xD8 &&
    frameData[frameData.length - 2] === 0xFF &&
    frameData[frameData.length - 1] === 0xD9
  );
}
