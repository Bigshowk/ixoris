// Relative import (not the "@ixoris/i18n" package specifier) on purpose: this package has no build step, so
// ts-node runs this file's raw TypeScript directly, and Node's native type-stripping refuses to process any
// .ts file reached through a node_modules path (even a workspace symlink) — a relative sibling-package import
// has no node_modules segment at all, sidestepping that restriction entirely. apps/web (webpack) doesn't have
// this restriction and could use the package specifier, but this file must stay ts-node-safe for apps/api.
import { formatCurrency, formatDateTime } from "../../i18n/src/format";
import type { Locale } from "../../i18n/src/types";
import { EscPosBuilder, PaperWidth } from "./builder";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
}

export interface SaleReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  taxId?: string; // NIF
  saleNumber: string;
  date: Date;
  cashierName: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  tvaTotal: number;
  total: number;
  /** ISO 4217 code (e.g. "XOF", "EUR") — Intl derives the right symbol and decimal precision from it. */
  currencyCode: string;
  /** Receipt language — defaults to "fr" to match the till's historical behavior. */
  locale?: Locale;
  payments: ReceiptPayment[];
  changeDue?: number;
  qrData?: string; // ex: lien de vérification / e-facture DGI
  footerMessage?: string;
}

function money(value: number, currencyCode: string, locale: Locale) {
  return formatCurrency(value, currencyCode, locale);
}

/** Builds the full ESC/POS byte stream for a POS sale ticket. */
export function buildSaleReceipt(data: SaleReceiptData, paperWidth: PaperWidth = "80mm"): Uint8Array {
  const b = new EscPosBuilder(paperWidth);
  const locale = data.locale ?? "fr";
  const m = (value: number) => money(value, data.currencyCode, locale);

  b.align("center").bold(true).doubleSize(true).line(data.storeName).doubleSize(false).bold(false);
  if (data.storeAddress) b.line(data.storeAddress);
  if (data.storePhone) b.line(`Tel: ${data.storePhone}`);
  if (data.taxId) b.line(`NIF: ${data.taxId}`);
  b.separator("=");

  b.align("left");
  b.line(`Ticket: ${data.saleNumber}`);
  b.line(`Date: ${formatDateTime(data.date, locale)}`);
  b.line(`Caissier: ${data.cashierName}`);
  if (data.customerName) b.line(`Client: ${data.customerName}`);
  b.separator("-");

  for (const item of data.items) {
    b.wrappedLine(item.name);
    const qtyPrice = `${item.quantity} x ${m(item.unitPrice)}`;
    b.row(qtyPrice, m(item.total));
    if (item.discount) {
      b.row("  Remise", `-${m(item.discount)}`);
    }
  }
  b.separator("-");

  b.row("Sous-total", m(data.subtotal));
  if (data.discountTotal > 0) {
    b.row("Remise totale", `-${m(data.discountTotal)}`);
  }
  b.row("TVA", m(data.tvaTotal));
  b.bold(true).doubleSize(true);
  b.row("TOTAL", m(data.total));
  b.doubleSize(false).bold(false);
  b.separator("-");

  for (const payment of data.payments) {
    b.row(payment.method, m(payment.amount));
  }
  if (data.changeDue && data.changeDue > 0) {
    b.row("Monnaie rendue", m(data.changeDue));
  }

  if (data.qrData) {
    b.feed(1).align("center").qrCode(data.qrData).feed(1);
  }

  b.align("center").feed(1);
  b.line(data.footerMessage ?? "Merci de votre visite !");
  b.cut();

  return b.toBytes();
}
