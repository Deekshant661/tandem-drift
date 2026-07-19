import {
  decodeServerMsg,
  encode,
  type ClientMsg,
  type ServerMsg,
} from '@tandem/shared';

export type MessageHandler = (msg: ServerMsg) => void;

/** Thin typed wrapper over the game WebSocket with RTT measurement. */
export class Connection {
  private readonly ws: WebSocket;
  private handler: MessageHandler = () => {};
  private pingTimer: number | null = null;
  /** Smoothed round-trip time, ms. */
  rttMs = 0;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('message', (ev) => {
      const msg = decodeServerMsg(String(ev.data));
      if (!msg) return;
      if (msg.type === 'pong') {
        const sample = performance.now() - msg.t;
        this.rttMs = this.rttMs === 0 ? sample : this.rttMs * 0.8 + sample * 0.2;
        return;
      }
      this.handler(msg);
    });
    this.ws.addEventListener('open', () => {
      this.pingTimer = window.setInterval(() => {
        this.send({ type: 'ping', t: performance.now() });
      }, 1000);
    });
    this.ws.addEventListener('close', () => {
      if (this.pingTimer !== null) clearInterval(this.pingTimer);
    });
  }

  onOpen(fn: () => void): void {
    this.ws.addEventListener('open', fn);
  }

  onClose(fn: () => void): void {
    this.ws.addEventListener('close', fn);
  }

  onMessage(fn: MessageHandler): void {
    this.handler = fn;
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(encode(msg));
  }
}
