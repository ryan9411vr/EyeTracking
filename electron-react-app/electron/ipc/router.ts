// electron/main/ipc/router.ts
import { ipcMain } from 'electron';
import { Channels, Handler } from '../types/channels';
import { safeIpc } from '../utils/safeIpc';

export function handle<C extends keyof Channels>(channel: C, handler: Handler<C>) {
  ipcMain.handle(channel, safeIpc(handler));
}

export function on<C extends keyof Channels>(channel: C, listener: (...args: any[]) => void) {
  ipcMain.on(channel as string, (_e, ...args) => listener(...args));
}
