// electron/main/ipc/handlers/osc.ts
import { handle } from '../ipc/router';
import { OscClient } from '../services/oscClient';

export function registerOscHandlers() {
  const client = new OscClient();

  handle('update-osc-client', async (_e, addr) => { client.update(addr); });

  handle('send-osc-eye-data', async (_e, pitch, yaw) => {
    client.send('/tracking/eye/CenterPitchYaw', [
      { type: 'f', value: pitch }, { type: 'f', value: yaw },
    ]);
  });

  handle('send-osc-four-eye-data', async (_e, lP, lY, rP, rY) => {
    client.send('/tracking/eye/LeftRightPitchYaw', [
      { type: 'f', value: lP }, { type: 'f', value: lY },
      { type: 'f', value: rP }, { type: 'f', value: rY },
    ]);
  });

  handle('send-osc-float-param', async (_e, address, value) => {
    client.send(address, [{ type: 'f', value }]);
  });

  handle('send-osc-eyes-closed-amount', async (_e, v) => {
    client.send('/tracking/eye/EyesClosedAmount', [{ type: 'f', value: v }]);
  });
}
