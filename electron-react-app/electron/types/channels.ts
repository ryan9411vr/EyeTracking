// electron/main/types/channels.ts
import type { IpcMainInvokeEvent } from 'electron';

export type Channels = {
  'focus-fix': { args: []; returns: void };

  'select-folder': { args: []; returns: string };
  'select-file': { args: [options: { filters?: Electron.FileFilter[] }]; returns: string };
  'read-file':   { args: [filePath: string]; returns: string }; // base64
  'delete-file': { args: [filePath: string]; returns: void };
  'file-exists': { args: [filePath: string]; returns: boolean };

  'create-database': { args: [filePath: string]; returns: void };
  'insert-training-data': { args: [data: {
    dbPath: string; timestamp: number; leftEyeFrame: string | null; rightEyeFrame: string | null;
    theta1: number; theta2: number; openness: number; type: string;
  }]; returns: void };
  'delete-recent-training-data': { args: [data: { dbPath: string; cutoff: number }]; returns: void };
  'count-training-data': { args: [filePath: string]; returns: number };

  'update-osc-client': { args: [oscAddress: string]; returns: void };
  'send-osc-eye-data': { args: [pitch: number, yaw: number]; returns: void };
  'send-osc-float-param': { args: [address: string, value: number]; returns: void };
  'send-osc-four-eye-data': { args: [lP: number, lY: number, rP: number, rY: number]; returns: void };
  'send-osc-eyes-closed-amount': { args: [closedAmount: number]; returns: void };

  'start-com-connection': { args: [options: { side: 'leftEye'|'rightEye'; port: string; baudRate?: number }]; returns: void };
  'stop-com-connection':  { args: [payload: { side: 'leftEye'|'rightEye' }]; returns: void };

  'generate-theta-heatmap': { args: [dbPath: string]; returns: string }; // base64
  'create-openness-distribution-plot': { args: [dbPath: string]; returns: string }; // base64

  'autoencoder:run': { args: [config: {
    dbPath: string;
    trainedModelOutputPath: string;
    convertedModelOutputPath: string;
    trainCombined: boolean;
    trainLeft: boolean;
    trainRight: boolean;
    convertCombined: boolean;
    convertLeft: boolean;
    convertRight: boolean;
  }]; returns: void };
};

export type Handler<C extends keyof Channels> =
  (event: IpcMainInvokeEvent, ...args: Channels[C]['args']) => Promise<Channels[C]['returns']> | Channels[C]['returns'];
