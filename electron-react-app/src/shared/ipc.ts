// src/shared/ipc.ts
export type TrainingConfig = {
  dbPath: string;
  outputDir: string;
  epochs?: number;
  batchSize?: number;
};

export type ProgressType = 'epochEnd' | 'batchEnd' | 'done' | 'error';

export interface TrainProgressData {
  id: string;
  type: ProgressType;
  payload: any;
}

export type Channels = {
  'select-folder': { args: []; returns: string };
  'select-file': { args: [options: { filters: { name: string; extensions: string[] }[] }]; returns: string };
  'read-file': { args: [filePath: string]; returns: string }; // base64
  'delete-file': { args: [filePath: string]; returns: void };
  'create-database': { args: [filePath: string]; returns: void };
  'count-training-data': { args: [filePath: string]; returns: number };
  'file-exists': { args: [filePath: string]; returns: boolean };

  'insert-training-data': { args: [data: {
    dbPath: string;
    timestamp: number;
    leftEyeFrame: string | null;
    rightEyeFrame: string | null;
    theta1: number;
    theta2: number;
    openness: number;
    type: string;
  }]; returns: void };

  'delete-recent-training-data': { args: [data: { dbPath: string; cutoff: number }]; returns: void };

  'update-osc-client': { args: [oscAddress: string]; returns: void };
  'send-osc-eye-data': { args: [pitch: number, yaw: number]; returns: void };
  'send-osc-float-param': { args: [address: string, value: number]; returns: void };
  'send-osc-four-eye-data': { args: [lP: number, lY: number, rP: number, rY: number]; returns: void };
  'send-osc-eyes-closed-amount': { args: [closedAmount: number]; returns: void };

  'generate-theta-heatmap': { args: [dbPath: string]; returns: string }; // base64
  'create-openness-distribution-plot': { args: [dbPath: string]; returns: string }; // base64

  'train:start': { args: [config: TrainingConfig]; returns: string };
  'train:cancel': { args: [id: string]; returns: void };

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
