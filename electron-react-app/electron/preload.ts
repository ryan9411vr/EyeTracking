// electron/preload.ts

/**
 * Exposes a secure API to the renderer process via Electron's contextBridge.
 *
 * This API provides a set of asynchronous functions that allow the renderer process to communicate
 * with the main process through IPC channels. These functions support file system operations,
 * database interactions, and OSC (Open Sound Control) communications while maintaining context isolation
 * and adhering to security best practices for Electron applications.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: async (): Promise<string> => {
    return await ipcRenderer.invoke('select-folder');
  },
  selectFile: async (options: { filters: { name: string; extensions: string[] }[] }): Promise<string> => {
    return await ipcRenderer.invoke('select-file', options);
  },
  deleteFile: async (filePath: string): Promise<void> => {
    return await ipcRenderer.invoke('delete-file', filePath);
  },
  createDatabaseFile: async (filePath: string): Promise<void> => {
    return await ipcRenderer.invoke('create-database', filePath);
  },
  fileExists: async (filePath: string): Promise<boolean> => {
    return await ipcRenderer.invoke('file-exists', filePath);
  },
  deleteRecentTrainingData: async (data: { dbPath: string; cutoff: number }): Promise<void> => {
    return await ipcRenderer.invoke('delete-recent-training-data', data);
  },
  insertTrainingData: async (data: {
    dbPath: string;
    timestamp: number;
    leftEyeFrame: string | null;
    rightEyeFrame: string | null;
    theta1: number;
    theta2: number;
    openness: number;
    type: string;
  }): Promise<void> => {
    return await ipcRenderer.invoke('insert-training-data', data);
  },
  countTrainingData: async (filePath: string): Promise<number> => {
    return await ipcRenderer.invoke('count-training-data', filePath);
  },
  readFile: async (filePath: string): Promise<string> => {
    return await ipcRenderer.invoke('read-file', filePath);
  },
  updateOscClient: async (vrcOsc: string): Promise<void> => {
    return await ipcRenderer.invoke('update-osc-client', vrcOsc);
  },
  sendOscEyeData: async (pitch: number, yaw: number): Promise<void> => {
    return await ipcRenderer.invoke('send-osc-eye-data', pitch, yaw);
  },
  sendOscFloatParam: async (address: string, value: number): Promise<void> => {
    return await ipcRenderer.invoke('send-osc-float-param', address, value);
  },
  sendOscFourEyeData: async (
    leftPitch: number,
    leftYaw: number,
    rightPitch: number,
    rightYaw: number
  ): Promise<void> => {
    return await ipcRenderer.invoke('send-osc-four-eye-data', leftPitch, leftYaw, rightPitch, rightYaw);
  },
  sendOscEyesClosedAmount: async (value: number): Promise<void> => {
    return await ipcRenderer.invoke('send-osc-eyes-closed-amount', value);
  },
  loadMdFile: (relativePath: string) => ipcRenderer.invoke('load-md-file', relativePath),
  getLocale: (): string => ipcRenderer.sendSync('get-locale'),
  focusFix: () => ipcRenderer.send('focus-fix'),
});

contextBridge.exposeInMainWorld('comCameraAPI', {
  startConnection: (options: { side: 'leftEye' | 'rightEye'; port: string; baudRate?: number }) => {
    ipcRenderer.send('start-com-connection', options);
  },
  stopConnection: (side: 'leftEye' | 'rightEye') => {
    ipcRenderer.send('stop-com-connection', { side });
  },
  onFrameUpdate: (callback: (event: Electron.IpcRendererEvent, payload: any) => void) => {
    ipcRenderer.on('camera-frame-update', callback);
  },
});