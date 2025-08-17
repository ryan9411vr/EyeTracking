// electron/main/windows/mainWindow.ts
import { BrowserWindow } from 'electron';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 1140,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.once('did-finish-load', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });

  if (isDev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', '..', 'build', 'index.html'));

  return win;
}
