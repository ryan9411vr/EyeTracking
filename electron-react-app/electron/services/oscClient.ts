// electron/main/services/oscClient.ts
import * as osc from 'osc';

// VRC OSC Interface
export class OscClient {
  private port: osc.UDPPort | null = null;
  private host = '';
  private udpPort = 0;

  update(oscAddress: string) {
    if (!oscAddress) return this.close();
    const [ip, portStr] = oscAddress.split(':');
    const port = Number(portStr);
    if (!ip || Number.isNaN(port)) return;

    if (this.port && ip === this.host && port === this.udpPort) return;
    this.close();
    this.port = new osc.UDPPort({ localAddress: '0.0.0.0', localPort: 0, remoteAddress: ip, remotePort: port, metadata: true });
    this.port.open();
    this.host = ip; this.udpPort = port;
  }

  send(address: string, args: { type: 'f'|'i'|'s'; value: any }[]) {
    if (!this.port) return;
    this.port.send({ address, args });
  }

  close() {
    if (this.port) { this.port.close(); this.port = null; }
    this.host = ''; this.udpPort = 0;
  }
}
