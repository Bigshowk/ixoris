// Minimal ambient typings — the WebUSB API isn't in lib.dom.d.ts yet.
interface UsbDeviceLike {
  open(): Promise<void>;
  close(): Promise<void>;
  configuration: { interfaces: UsbInterfaceLike[] } | null;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array): Promise<unknown>;
}
interface UsbInterfaceLike {
  interfaceNumber: number;
  alternates: { interfaceClass: number; endpoints: { direction: string; endpointNumber: number }[] }[];
}
interface UsbLike {
  requestDevice(options: { filters: unknown[] }): Promise<UsbDeviceLike>;
}

const PRINTER_INTERFACE_CLASS = 7; // USB spec: Printer class

/**
 * Prints raw ESC/POS bytes to a USB thermal printer via WebUSB. Requires a
 * user gesture (click) to trigger the device picker — call this directly
 * from a button handler, not from an effect.
 */
export async function printViaUsb(bytes: Uint8Array): Promise<void> {
  const usb = (navigator as unknown as { usb?: UsbLike }).usb;
  if (!usb) throw new Error("WebUSB is not supported in this browser");

  const device = await usb.requestDevice({ filters: [] });
  await device.open();
  if (!device.configuration) await device.selectConfiguration(1);

  const iface =
    device.configuration!.interfaces.find((i) => i.alternates.some((a) => a.interfaceClass === PRINTER_INTERFACE_CLASS)) ??
    device.configuration!.interfaces[0];
  if (!iface) throw new Error("No usable USB interface found on this device");

  await device.claimInterface(iface.interfaceNumber);
  const outEndpoint = iface.alternates[0]?.endpoints.find((e) => e.direction === "out");
  if (!outEndpoint) throw new Error("No OUT endpoint found on printer interface");

  await device.transferOut(outEndpoint.endpointNumber, bytes);
  await device.close();
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}
