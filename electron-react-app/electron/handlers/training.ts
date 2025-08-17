// electron/main/ipc/handlers/training.ts
import { handle } from '../ipc/router';
import { autoencoderTrainer } from '../training/autoencoderTrainer';

export function registerTrainingHandlers() {
  handle('autoencoder:run', async(_e, config) => autoencoderTrainer(config));
}
