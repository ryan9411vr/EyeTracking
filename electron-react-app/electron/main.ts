// electron/main.ts

/**
 * Main process entry for the Electron application.
 *
 * This file sets up the main BrowserWindow, configures IPC handlers for file system operations,
 * database operations (using SQLite3), and OSC communication. The IPC channels allow the renderer
 * process to interact with the main process for functionalities such as file selection, database
 * management, and sending OSC messages.
 *
 * The code distinguishes between development and production modes, disabling background throttling
 * and removing the application menu in production.
 * 
 * Note the ipc handlers in here are allowing the embedded browser to do things at the OS level.
 *
 * @module Main
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import * as osc from 'osc';
import { createMJPEGCOMConnection, CameraConnection } from './serial/comCameraService';

// Global variables
let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

/**
 * Creates and initializes the main application window.
 *
 * Sets the initial dimensions, loads the appropriate URL (development or production build),
 * and sets up the necessary web preferences.
 */
const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 1140,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  }
};

/**
 * Application initialization once Electron is ready.
 *
 * Sets command-line switches to disable background throttling, configures the application menu,
 * creates the main window, and registers all IPC handlers.
 */
app.whenReady().then(() => {
  // Disable various background throttling features. Client needs to run when VRC is the focused window.
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

  // Remove application menu in production mode

  createWindow();

  /* =================== IPC HANDLERS =================== */

  // --- Window Focus Fix ---
  // Workaround for an outstanding electron issue that breaks input text fields on system windows.
  ipcMain.on('focus-fix', () => {
    if (mainWindow) {
      mainWindow.blur();
      mainWindow.focus();
    }
  });

  // --- Folder Selection Dialog ---
  // Opens a folder selection dialog and returns the selected directory path.
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return "";
  });

  // --- File Reading ---
  // Reads the specified file and returns its content encoded in Base64.
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    return fs.readFileSync(filePath, { encoding: 'base64' });
  });

  // --- File Selection Dialog ---
  // Opens a file selection dialog with provided filters and returns the selected file path.
  ipcMain.handle('select-file', async (_event, options) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options.filters,
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return "";
  });

  // --- File Deletion ---
  // Deletes the specified file. Throws an error if the operation fails.
  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  });

  // --- Database Creation ---
  // Creates a new SQLite database at the specified path. Resolves when done.
  ipcMain.handle('create-database', async (_event, filePath: string) => {
    return new Promise<void>((resolve, reject) => {
      const db = new sqlite3.Database(filePath, (err) => {
        if (err) {
          console.error("Error creating database:", err);
          reject(err);
        } else {
          db.close((closeErr) => {
            if (closeErr) {
              console.error("Error closing database:", closeErr);
              reject(closeErr);
            } else {
              resolve();
            }
          });
        }
      });
    });
  });

  // --- Insert Training Data ---
  // Inserts a new training data record into the SQLite database.
  ipcMain.handle('insert-training-data', async (_event, data: {
    dbPath: string;
    timestamp: number;
    leftEyeFrame: string | null;
    rightEyeFrame: string | null;
    theta1: number;
    theta2: number;
    openness: number;
    type: string;
  }) => {
    return new Promise<void>((resolve, reject) => {
      const { dbPath, timestamp, leftEyeFrame, rightEyeFrame, theta1, theta2, openness, type } = data;
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error("Error opening database:", err);
          return reject(err);
        }
        // Ensure the training_data table exists
        db.run(
          `CREATE TABLE IF NOT EXISTS training_data (
            timestamp INTEGER PRIMARY KEY,
            leftEyeFrame TEXT,
            rightEyeFrame TEXT,
            theta1 REAL,
            theta2 REAL,
            openness REAL,
            type TEXT
          )`,
          (err) => {
            if (err) {
              console.error("Error creating training_data table:", err);
              db.close();
              return reject(err);
            }
            // Insert the new training data record
            db.run(
              `INSERT INTO training_data (timestamp, leftEyeFrame, rightEyeFrame, theta1, theta2, openness, type)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [timestamp, leftEyeFrame, rightEyeFrame, theta1, theta2, openness, type],
              function (err) {
                if (err) {
                  console.error("Error inserting training data:", err);
                  db.close();
                  return reject(err);
                }
                db.close((closeErr) => {
                  if (closeErr) {
                    console.error("Error closing database:", closeErr);
                    return reject(closeErr);
                  }
                  resolve();
                });
              }
            );
          }
        );
      });
    });
  });

  // --- Delete Recent Training Data ---
  // Deletes training data records from the database where the timestamp is greater than or equal to the cutoff.
  ipcMain.handle('delete-recent-training-data', async (_event, data: { dbPath: string; cutoff: number }) => {
    return new Promise<void>((resolve, reject) => {
      const { dbPath, cutoff } = data;
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error("Error opening database for deletion:", err);
          return reject(err);
        }
        db.run(
          `DELETE FROM training_data WHERE timestamp >= ?`,
          [cutoff],
          function (err) {
            if (err) {
              console.error("Error deleting recent training data:", err);
              db.close();
              return reject(err);
            }
            db.close((closeErr) => {
              if (closeErr) {
                console.error("Error closing database after deletion:", closeErr);
                return reject(closeErr);
              }
              resolve();
            });
          }
        );
      });
    });
  });

  // --- Count Training Data ---
  // Counts the number of records in the training_data table.
  ipcMain.handle('count-training-data', async (_event, filePath: string) => {
    return new Promise<number>((resolve, reject) => {
      const db = new sqlite3.Database(filePath, (err) => {
        if (err) {
          console.error("Error opening database for counting:", err);
          return reject(err);
        }
        // Ensure the training_data table exists before counting
        db.run(
          `CREATE TABLE IF NOT EXISTS training_data (
            timestamp INTEGER PRIMARY KEY,
            leftEyeFrame TEXT,
            rightEyeFrame TEXT,
            theta1 REAL,
            theta2 REAL,
            openness REAL,
            type TEXT
          )`,
          (err) => {
            if (err) {
              console.error("Error creating training_data table:", err);
              db.close();
              return reject(err);
            }
            db.get("SELECT COUNT(*) AS count FROM training_data", (err, row: { count: number } | undefined) => {
              if (err) {
                console.error("Error counting training data:", err);
                db.close();
                return reject(err);
              }
              const count = row?.count || 0;
              db.close((closeErr) => {
                if (closeErr) {
                  console.error("Error closing database after counting:", closeErr);
                  return reject(closeErr);
                }
                resolve(count);
              });
            });
          }
        );
      });
    });
  });

  // --- Check File Existence ---
  // Returns a boolean indicating whether the specified file exists.
  ipcMain.handle('file-exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath);
  });

  /* =================== OSC COMMUNICATION =================== */

  // Global OSC client variables.
  let oscClient: osc.UDPPort | null = null;
  let currentOscHost = '';
  let currentOscPort = 0;

  /**
   * Updates (or closes) the OSC client based on the provided address.
   *
   * If the provided oscAddress is empty, any existing OSC client is closed.
   * If the address is valid and different from the current configuration,
   * the existing client (if any) is closed and a new OSC client is created.
   *
   * @param oscAddress - A string in the format "ip:port" to specify the OSC target.
   */
  function updateOscClient(oscAddress: string): void {
    if (!oscAddress) {
      if (oscClient) {
        oscClient.close();
        oscClient = null;
      }
      currentOscHost = '';
      currentOscPort = 0;
      return;
    }
    const [ip, portStr] = oscAddress.split(':');
    const port = parseInt(portStr, 10);
    if (!ip || isNaN(port)) {
      console.warn('Invalid OSC address format. Expected "ip:port".');
      return;
    }
    if (oscClient && ip === currentOscHost && port === currentOscPort) {
      return;
    }
    if (oscClient) {
      oscClient.close();
      oscClient = null;
    }
    oscClient = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: 0,
      remoteAddress: ip,
      remotePort: port,
      metadata: true,
    });
    oscClient.open();
    currentOscHost = ip;
    currentOscPort = port;
    console.log(`OSC client updated to send messages to ${ip}:${port}`);
  }

  // --- Update OSC Client ---
  // Updates the OSC client configuration based on the provided address.
  ipcMain.handle('update-osc-client', async (_event, oscAddress: string) => {
    updateOscClient(oscAddress);
  });

  // --- Send OSC Eye Data ---
  // Sends eye tracking data (pitch and yaw) via OSC.
  ipcMain.handle('send-osc-eye-data', async (_event, pitch: number, yaw: number) => {
    if (!oscClient) {
      console.warn('OSC client not initialized.');
      return;
    }
    const msg = {
      address: '/tracking/eye/CenterPitchYaw',
      args: [
        { type: 'f', value: pitch },
        { type: 'f', value: yaw },
      ],
    };
    oscClient.send(msg);
  });

  // --- Send OSC Float Parameter ---
  // Sends a single floating point value to a specified OSC address.
  ipcMain.handle('send-osc-float-param', async (_event, address: string, value: number) => {
    if (!oscClient) {
      console.warn('OSC client not initialized.');
      return;
    }
    const msg = {
      address,
      args: [
        { type: 'f', value },
      ],
    };
    oscClient.send(msg);
  });

  // --- Load Markdown File ---
  // Loads a markdown file from the build directory and returns its content as text.
  ipcMain.handle('load-md-file', async (_event, relativePath: string) => {
    try {
      const fullPath = path.join(__dirname, '..', 'build', relativePath);
      const text = fs.readFileSync(fullPath, 'utf8');
      return text;
    } catch (error) {
      console.error('Error reading MD file:', error);
      return '# Error\nCould not load this page.';
    }
  });

  // --- Send OSC Four Eye Data ---
  // Sends OSC message containing pitch and yaw data for both eyes.
  ipcMain.handle('send-osc-four-eye-data', async (
    _event,
    leftPitch: number,
    leftYaw: number,
    rightPitch: number,
    rightYaw: number
  ) => {
    if (!oscClient) {
      console.warn('OSC client not initialized.');
      return;
    }
    const msg = {
      address: '/tracking/eye/LeftRightPitchYaw',
      args: [
        { type: 'f', value: leftPitch },
        { type: 'f', value: leftYaw },
        { type: 'f', value: rightPitch },
        { type: 'f', value: rightYaw },
      ],
    };
    oscClient.send(msg);
  });

  // --- Send OSC Eyes Closed Amount ---
  // Sends an OSC message indicating the amount that the eyes are closed.
  ipcMain.handle('send-osc-eyes-closed-amount', async (_event, closedAmount: number) => {
    if (!oscClient) {
      console.warn('OSC client not initialized.');
      return;
    }
    const msg = {
      address: '/tracking/eye/EyesClosedAmount',
      args: [
        { type: 'f', value: closedAmount },
      ],
    };
    oscClient.send(msg);
  });

  const comConnections: { [side: string]: CameraConnection } = {};

  ipcMain.on(
    'start-com-connection',
    (
      event,
      options: { side: 'leftEye' | 'rightEye'; port: string; baudRate?: number }
    ) => {
      // If a connection for this side already exists, close it.
      if (comConnections[options.side]) {
        comConnections[options.side].close();
      }
      // Create and store the new connection.
      comConnections[options.side] = createMJPEGCOMConnection(options);
      console.log(`Main: Started COM connection for ${options.side} on port ${options.port}`);
    }
  );
  
  ipcMain.on('stop-com-connection', (event, payload: { side: 'leftEye' | 'rightEye' }) => {
    const connection = comConnections[payload.side];
    if (connection) {
      connection.close();
      delete comConnections[payload.side];
      console.log(`Main: Stopped COM connection for ${payload.side}`);
    }
  });

});

/**
 * Re-create a window if none are open (macOS specific behavior).
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/**
 * Quit the application when all windows are closed, except on macOS.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
