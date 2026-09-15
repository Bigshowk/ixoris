import { encodeCp850 } from "./encoding";

export type PaperWidth = "58mm" | "80mm";

/** Characters per line for a monospace font size 0 (font A) on standard thermal printers. */
export const CHARS_PER_LINE: Record<PaperWidth, number> = {
  "58mm": 32,
  "80mm": 48,
};

export type Align = "left" | "center" | "right";

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Builds a raw ESC/POS byte buffer for thermal receipt printers.
 * Works for USB (WebUSB), network (raw TCP :9100) and Bluetooth-SPP printers —
 * they all consume the same byte stream.
 */
export class EscPosBuilder {
  private bytes: number[] = [];
  readonly width: number;

  constructor(paperWidth: PaperWidth = "80mm") {
    this.width = CHARS_PER_LINE[paperWidth];
    this.bytes.push(ESC, 0x40); // ESC @ — initialize printer
    this.bytes.push(ESC, 0x74, 0x02); // ESC t 2 — select CP850 code page
  }

  private push(...values: number[]) {
    this.bytes.push(...values);
    return this;
  }

  align(align: Align) {
    const n = align === "left" ? 0 : align === "center" ? 1 : 2;
    return this.push(ESC, 0x61, n);
  }

  bold(on: boolean) {
    return this.push(ESC, 0x45, on ? 1 : 0);
  }

  underline(on: boolean) {
    return this.push(ESC, 0x2d, on ? 1 : 0);
  }

  /** Double height/width text (used for totals, headers). */
  doubleSize(on: boolean) {
    return this.push(GS, 0x21, on ? 0x11 : 0x00);
  }

  text(value: string) {
    this.bytes.push(...encodeCp850(value));
    return this;
  }

  line(value = "") {
    return this.text(value).feed(1);
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) this.bytes.push(0x0a);
    return this;
  }

  /** Draws a full-width separator, e.g. "--------------------------------". */
  separator(char = "-") {
    return this.line(char.repeat(this.width));
  }

  /** Left-aligned label + right-aligned value on one line (classic receipt row). */
  row(label: string, value: string) {
    const space = this.width - label.length - value.length;
    const padded = space > 0 ? label + " ".repeat(space) + value : `${label} ${value}`;
    return this.line(padded);
  }

  /** Wraps and truncates a product name to fit the paper width over multiple lines. */
  wrappedLine(value: string) {
    const words = value.split(" ");
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > this.width) {
        this.line(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`;
      }
    }
    if (current.trim()) this.line(current.trim());
    return this;
  }

  /** QR code (GS ( k sequence), typically used for e-invoice / DGI verification codes. */
  qrCode(data: string, moduleSize = 6) {
    const dataBytes = encodeCp850(data);
    const storeLen = dataBytes.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;

    // Model 2
    this.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Module size
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize);
    // Error correction level M
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // Store data
    this.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes);
    // Print
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  /**
   * Prints a 1-bit monochrome raster image (GS v 0 command — supported by virtually every
   * ESC/POS-compatible thermal printer). `widthPx` must be a multiple of 8; `bitmap` is
   * row-major, MSB-first, 1 = black dot, length = (widthPx / 8) * heightPx.
   */
  rasterImage(bitmap: Uint8Array, widthPx: number, heightPx: number) {
    const widthBytes = widthPx / 8;
    this.push(GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, heightPx & 0xff, (heightPx >> 8) & 0xff);
    this.bytes.push(...bitmap);
    return this;
  }

  /** Opens the cash drawer connected to the printer's RJ11 port. */
  openDrawer() {
    return this.push(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  /** Feeds paper and performs a partial cut. */
  cut() {
    this.feed(3);
    return this.push(GS, 0x56, 0x01);
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}
