/// <reference types="electron" />

// src/global.d.ts

/**
 * The ElectronAPI interface defines a set of functions for interacting with native functionality
 * provided by the Electron main process. These methods cover operations such as file system management,
 * SQLite database handling, OSC (Open Sound Control) communication, and system locale retrieval.
 *
 * All asynchronous methods return Promises, while some methods are synchronous (e.g. focusFix).
 * This interface is exposed globally via the window.electronAPI object.
 */
export interface ElectronAPI {
  /**
   * Opens a native folder picker and returns the selected folder path.
   *
   * @returns A promise that resolves with the selected folder path.
   */
  selectFolder: () => Promise<string>;

  /**
   * Opens a native file picker with the specified options and returns the selected file path.
   *
   * @param options - An object containing file filters.
   * @returns A promise that resolves with the selected file path.
   */
  selectFile: (options: { filters: { name: string; extensions: string[] }[] }) => Promise<string>;

  /**
   * Deletes the file at the specified file path.
   *
   * @param filePath - The full file path of the file to delete.
   * @returns A promise that resolves when the file is deleted.
   */
  deleteFile: (filePath: string) => Promise<void>;

  /**
   * Creates a new SQLite database file at the given file path.
   *
   * @param filePath - The full file path where the database should be created.
   * @returns A promise that resolves when the database file is created.
   */
  createDatabaseFile: (filePath: string) => Promise<void>;

  /**
   * Checks if a file exists at the given file path.
   *
   * @param filePath - The full file path to check.
   * @returns A promise that resolves with true if the file exists, or false otherwise.
   */
  fileExists: (filePath: string) => Promise<boolean>;

  /**
   * Inserts a new training data record into the SQLite database.
   *
   * @param data - An object containing the training data, including:
   *   - dbPath: The path to the database.
   *   - timestamp: The record's timestamp.
   *   - leftEyeFrame: A base64 string of the left eye frame, or null.
   *   - rightEyeFrame: A base64 string of the right eye frame, or null.
   *   - theta1: The first theta value.
   *   - theta2: The second theta value.
   *   - openness: The eye openness value.
   *   - type: A string describing the type of training data.
   * @returns A promise that resolves when the data has been inserted.
   */
  insertTrainingData: (data: {
    dbPath: string,
    timestamp: number,
    leftEyeFrame: string | null,
    rightEyeFrame: string | null,
    theta1: number,
    theta2: number,
    openness: number,
    type: string
  }) => Promise<void>;

  /**
   * Deletes training data entries from the SQLite database with a timestamp greater than or equal to the cutoff.
   *
   * @param data - An object containing:
   *   - dbPath: The path to the database.
   *   - cutoff: The timestamp cutoff.
   * @returns A promise that resolves when the specified data has been deleted.
   */
  deleteRecentTrainingData: (data: { dbPath: string, cutoff: number }) => Promise<void>;

  /**
   * Counts the number of entries in the training_data table.
   *
   * @param filePath - The full file path to the database.
   * @returns A promise that resolves with the count of training data entries.
   */
  countTrainingData: (filePath: string) => Promise<number>;

  /**
   * Reads a local file and returns its contents as a Base64 string.
   *
   * @param filePath - The full file path of the file to read.
   * @returns A promise that resolves with the file contents encoded in Base64.
   */
  readFile: (filePath: string) => Promise<string>;

  /**
   * Updates the OSC client with the specified VRC OSC address.
   *
   * @param vrcOsc - The OSC address for VRC.
   * @returns A promise that resolves when the OSC client is updated.
   */
  updateOscClient: (vrcOsc: string) => Promise<void>;

  /**
   * Sends OSC messages containing eye data (pitch and yaw).
   *
   * @param pitch - The pitch value.
   * @param yaw - The yaw value.
   * @returns A promise that resolves when the OSC message is sent.
   */
  sendOscEyeData: (pitch: number, yaw: number) => Promise<void>;

  /**
   * Sends an OSC message with a float parameter to a specific address.
   *
   * @param address - The OSC address.
   * @param value - The float parameter value.
   * @returns A promise that resolves when the OSC message is sent.
   */
  sendOscFloatParam: (address: string, value: number) => Promise<void>;

  /**
   * Loads a Markdown file from the given relative path.
   *
   * @param relativePath - The relative path to the Markdown file.
   * @returns A promise that resolves with the contents of the file.
   */
  loadMdFile: (relativePath: string) => Promise<string>;

  // Native OSC methods:

  /**
   * Sends OSC messages for four eye data parameters (left and right pitch and yaw).
   *
   * @param leftPitch - The left eye pitch.
   * @param leftYaw - The left eye yaw.
   * @param rightPitch - The right eye pitch.
   * @param rightYaw - The right eye yaw.
   * @returns A promise that resolves when the OSC message is sent.
   */
  sendOscFourEyeData: (leftPitch: number, leftYaw: number, rightPitch: number, rightYaw: number) => Promise<void>;

  /**
   * Sends an OSC message representing the eyes closed amount.
   *
   * @param value - The value representing how closed the eyes are.
   * @returns A promise that resolves when the OSC message is sent.
   */
  sendOscEyesClosedAmount: (value: number) => Promise<void>;

  // Synchronous native method:

  /**
   * Requests the main process to trigger a focus fix (blurring and re-focusing the main window).
   * This fix is a workaround to deal with an open electron issue:
   * https://github.com/electron/electron/issues/31917
   */
  focusFix: () => void;
}

export interface ComCameraAPI {
  /**
   * Starts a COM connection.
   * @param options - An object containing side, port, and optionally baudRate.
   */
  startConnection: (options: { side: 'leftEye' | 'rightEye'; port: string; baudRate?: number }) => void;

  /**
   * Stops a COM connection for the specified side.
   * @param side - 'leftEye' or 'rightEye'
   */
  stopConnection: (side: 'leftEye' | 'rightEye') => void;

  /**
   * Registers a callback for frame updates coming from the main process.
   * @param callback - Function to call with (event, payload)
   */
  onFrameUpdate: (callback: (event: Electron.IpcRendererEvent, payload: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    comCameraAPI: ComCameraAPI;
  }
}

export {};
