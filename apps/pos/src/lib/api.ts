import type {
  AddCartItemInput,
  CartDTO,
  CheckoutInput,
  CreateCartInput,
  ProductSummary,
  SaleDTO,
  UpdateCartItemInput,
} from "@ixoris/types";
import { API_URL } from "./config";
import { getSession } from "./session";
import { authApi } from "./auth-api";
import { getAccessToken } from "./tokens";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const session = getSession();
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (session) headers["x-store-id"] = session.storeId;
  return headers;
}

async function rawFetch(path: string, options: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...options, headers: buildHeaders(options.headers as Record<string, string>) });
}

/** Retries once after a silent token refresh if the access token has expired mid-session. */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401) {
    const refreshed = await authApi.refresh();
    if (refreshed) res = await rawFetch(path, options);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || `Request to ${path} failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  findProductByBarcode: (barcode: string) => apiFetch<ProductSummary>(`/products/barcode/${encodeURIComponent(barcode)}`),
  searchProducts: (query: string) => apiFetch<ProductSummary[]>(`/products/search?q=${encodeURIComponent(query)}`),

  createCart: (input: CreateCartInput) => apiFetch<CartDTO>("/pos/carts", { method: "POST", body: JSON.stringify(input) }),
  getCart: (cartId: string) => apiFetch<CartDTO>(`/pos/carts/${cartId}`),
  /** Every ACTIVE cart in the store — including ones started on another device — for the "reprendre un panier" drawer. */
  listActiveCarts: (storeId: string) => apiFetch<CartDTO[]>(`/pos/carts/active?storeId=${encodeURIComponent(storeId)}`),
  addCartItem: (cartId: string, input: AddCartItemInput) =>
    apiFetch<CartDTO>(`/pos/carts/${cartId}/items`, { method: "POST", body: JSON.stringify(input) }),
  updateCartItem: (cartId: string, itemId: string, input: UpdateCartItemInput) =>
    apiFetch<CartDTO>(`/pos/carts/${cartId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(input) }),
  removeCartItem: (cartId: string, itemId: string) =>
    apiFetch<CartDTO>(`/pos/carts/${cartId}/items/${itemId}`, { method: "DELETE" }),

  checkout: (input: CheckoutInput) => apiFetch<SaleDTO>("/pos/sales/checkout", { method: "POST", body: JSON.stringify(input) }),

  printTicket: (saleId: string, host: string, port?: number) =>
    apiFetch<void>("/print/ticket", { method: "POST", body: JSON.stringify({ saleId, host, port }) }),

  async getTicketBytes(saleId: string): Promise<Uint8Array> {
    let res = await fetch(`${API_URL}/print/ticket/${saleId}/bytes`, { headers: buildHeaders() });
    if (res.status === 401 && (await authApi.refresh())) {
      res = await fetch(`${API_URL}/print/ticket/${saleId}/bytes`, { headers: buildHeaders() });
    }
    if (!res.ok) throw new ApiError(res.status, `Could not fetch ticket bytes for sale ${saleId}`);
    return new Uint8Array(await res.arrayBuffer());
  },
};

export { API_URL };
