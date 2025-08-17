// electron/main/utils/safeIpc.ts
export function safeIpc<T extends (...a: any[]) => any>(fn: T) {
  return async (event: Electron.IpcMainInvokeEvent, ...args: any[]) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      // central place to log & normalize errors
      console.error(`[IPC ERROR] ${event?.sender?.id ?? ''}`, err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  };
}
