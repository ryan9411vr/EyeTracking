// electron/main/app.ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows/mainWindow';
import { registerAllIpc } from './ipc/register';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

  mainWindow = createMainWindow();
  registerAllIpc({ mainWindow });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
