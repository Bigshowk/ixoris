import { Cart, CartItem, Payment, Product, Sale, SaleItem } from "@ixoris/database";
import { CartDTO, CartItemDTO, SaleDTO, SaleItemDTO } from "@ixoris/types";

/**
 * Money fields come back from Prisma as `Decimal` (decimal.js) instances.
 * We convert to plain `number` at the API boundary for simplicity in the POS
 * slice — the accounting engine, which is far more rounding-sensitive, keeps
 * full Decimal precision end to end instead.
 */
export function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

export function mapCartItem(item: CartItem & { product: Product }): CartItemDTO {
  const quantity = toNumber(item.quantity);
  const unitPrice = toNumber(item.unitPrice);
  const discount = toNumber(item.discount);
  const tvaRate = toNumber(item.product.tvaRate);
  const lineSubtotal = quantity * unitPrice - discount;
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    quantity,
    unitPrice,
    discount,
    tvaRate,
    total: Math.round((lineSubtotal + lineSubtotal * (tvaRate / 100)) * 100) / 100,
  };
}

export function mapCart(cart: Cart & { items: (CartItem & { product: Product })[] }): CartDTO {
  const items = cart.items.map(mapCartItem);
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountTotal = items.reduce((sum, i) => sum + i.discount, 0);
  const tvaTotal = items.reduce((sum, i) => sum + (i.total - (i.quantity * i.unitPrice - i.discount)), 0);
  const total = items.reduce((sum, i) => sum + i.total, 0);

  return {
    id: cart.id,
    storeId: cart.storeId,
    customerId: cart.customerId,
    deviceId: cart.deviceId,
    createdById: cart.createdById,
    status: cart.status,
    items,
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    tvaTotal: round2(tvaTotal),
    total: round2(total),
    updatedAt: cart.updatedAt.toISOString(),
  };
}

export function mapSaleItem(item: SaleItem & { product: Product }): SaleItemDTO {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    discount: toNumber(item.discount),
    tvaRate: toNumber(item.tvaRate),
    total: toNumber(item.total),
  };
}

export function mapSale(
  sale: Sale & { items: (SaleItem & { product: Product })[]; payments: Payment[] },
): SaleDTO {
  const totalPaid = sale.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
  const total = toNumber(sale.total);
  return {
    id: sale.id,
    storeId: sale.storeId,
    number: sale.number,
    date: sale.date.toISOString(),
    status: sale.status,
    customerId: sale.customerId,
    subtotal: toNumber(sale.subtotal),
    discountTotal: toNumber(sale.discountTotal),
    tvaTotal: toNumber(sale.tvaTotal),
    total,
    currencyCode: sale.currencyCode,
    items: sale.items.map(mapSaleItem),
    payments: sale.payments.map((p) => ({ method: p.method, amount: toNumber(p.amount), reference: p.reference })),
    changeDue: round2(Math.max(0, totalPaid - total)),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
