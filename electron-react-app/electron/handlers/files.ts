// electron/main/ipc/handlers/files.ts
import fs from 'fs';
import { dialog } from 'electron';
import { handle } from '../ipc/router';

export function registerFileHandlers() {
  handle('select-folder', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return !res.canceled && res.filePaths[0] ? res.filePaths[0] : '';
  });

  handle('select-file', async (_e, options) => {
    const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: options?.filters });
    return !res.canceled && res.filePaths[0] ? res.filePaths[0] : '';
  });

  handle('read-file', async (_e, filePath) => fs.readFileSync(filePath, { encoding: 'base64' }));

  handle('delete-file', async (_e, filePath) => { fs.unlinkSync(filePath); });

  handle('file-exists', async (_e, filePath) => fs.existsSync(filePath));
}
