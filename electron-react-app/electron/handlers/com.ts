// electron/main/ipc/handlers/com.ts
import { on } from '../ipc/router';
import { createMJPEGCOMConnection, CameraConnection } from '../serial/comCameraService';

export function registerComHandlers() {
  const conns: Record<'leftEye'|'rightEye', CameraConnection | undefined> = { leftEye: undefined, rightEye: undefined };

  on('start-com-connection', (options: { side: 'leftEye'|'rightEye'; port: string; baudRate?: number }) => {
    const { side } = options;
    conns[side]?.close();
    conns[side] = createMJPEGCOMConnection(options);
    console.log(`COM started for ${side} on ${options.port}`);
  });

on('stop-com-connection',  (side: 'leftEye'|'rightEye' )=> {
    conns[side]?.close();
    conns[side] = undefined;
    console.log(`COM stopped for ${side}`);
  });
}
