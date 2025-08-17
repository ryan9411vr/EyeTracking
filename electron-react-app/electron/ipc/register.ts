// electron/main/ipc/register.ts
import { registerFileHandlers } from '../handlers/files';
import { registerDbHandlers } from '../handlers/db';
import { registerOscHandlers } from '../handlers/osc';
import { registerComHandlers } from '../handlers/com';
import { registerPlotHandlers } from '../handlers/plots';
import { registerTrainingHandlers } from '../handlers/training';
import { ipcMain, BrowserWindow } from 'electron';

export function registerAllIpc(_ctx: { mainWindow: BrowserWindow }) {

  // Bug fix for an electron issue with modal dialoges and inputs.
  ipcMain.on('focus-fix', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) { win.blur(); win.focus(); }
  });

  registerFileHandlers();
  registerDbHandlers();
  registerOscHandlers();
  registerComHandlers();
  registerPlotHandlers();
  registerTrainingHandlers();
}
