import { z } from "zod";

// Mirrors the Prisma `PaymentMethod` enum (packages/database/prisma/schema.prisma)
export const paymentMethodSchema = z.enum([
  "CASH",
  "CARD",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "CHECK",
  "CREDIT",
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const cartStatusSchema = z.enum(["ACTIVE", "CONVERTED", "ABANDONED"]);
export type CartStatus = z.infer<typeof cartStatusSchema>;

// --- Product lookup (scan) ---------------------------------------------------

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  tvaRate: number;
  unitLabel: string | null;
  imageUrl: string | null;
  barcode: string | null;
  availableQuantity: number;
}

// --- Cart ---------------------------------------------------------------------

export const createCartInputSchema = z.object({
  storeId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
});
export type CreateCartInput = z.infer<typeof createCartInputSchema>;

export const addCartItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceOverride: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().default(0),
});
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>;

export const updateCartItemInputSchema = z.object({
  quantity: z.number().positive().optional(),
  discount: z.number().nonnegative().optional(),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

export interface CartItemDTO {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tvaRate: number;
  total: number;
}

export interface CartDTO {
  id: string;
  storeId: string;
  customerId: string | null;
  deviceId: string | null;
  createdById: string;
  status: CartStatus;
  items: CartItemDTO[];
  subtotal: number;
  discountTotal: number;
  tvaTotal: number;
  total: number;
  updatedAt: string;
}

// --- Checkout / Sale ------------------------------------------------------------

export const tenderInputSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().positive(),
  reference: z.string().optional(),
});
export type TenderInput = z.infer<typeof tenderInputSchema>;

export const checkoutInputSchema = z.object({
  cartId: z.string().min(1),
  registerId: z.string().min(1).optional(),
  cashSessionId: z.string().min(1).optional(),
  payments: z.array(tenderInputSchema).min(1),
});
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export interface SaleItemDTO {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tvaRate: number;
  total: number;
}

export interface SaleDTO {
  id: string;
  storeId: string;
  number: string;
  date: string;
  status: "DRAFT" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  customerId: string | null;
  subtotal: number;
  discountTotal: number;
  tvaTotal: number;
  total: number;
  currencyCode: string;
  items: SaleItemDTO[];
  payments: { method: PaymentMethod; amount: number; reference: string | null }[];
  changeDue: number;
}

// --- Realtime (WebSocket) events -------------------------------------------------

export interface CartUpdatedEvent {
  type: "cart:updated";
  cart: CartDTO;
}

export interface SaleCompletedEvent {
  type: "sale:completed";
  sale: SaleDTO;
}

export type PosRealtimeEvent = CartUpdatedEvent | SaleCompletedEvent;
