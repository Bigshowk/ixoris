import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Socket } from "net";

/**
 * Sends a raw ESC/POS byte stream to a network thermal printer over TCP
 * (port 9100 is the de-facto standard for Epson/Star/generic clones).
 * Browsers cannot open raw TCP sockets, so LAN printers are always driven
 * through this backend endpoint; USB printers are instead handled client-side
 * via WebUSB (see apps/pos print utilities).
 */
@Injectable()
export class NetworkPrinterClient {
  private readonly logger = new Logger(NetworkPrinterClient.name);

  async send(host: string, port: number, data: Uint8Array, timeoutMs = 5000): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new ServiceUnavailableException(`Printer ${host}:${port} timed out`));
      }, timeoutMs);

      socket.once("error", (err) => {
        clearTimeout(timer);
        this.logger.warn(`Print to ${host}:${port} failed: ${err.message}`);
        reject(new ServiceUnavailableException(`Could not reach printer ${host}:${port}`));
      });

      socket.connect(port, host, () => {
        socket.write(Buffer.from(data), () => {
          socket.end();
        });
      });

      socket.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
