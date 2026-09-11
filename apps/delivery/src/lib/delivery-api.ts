import { API_URL } from "./config";
import { getSession } from "./session";
import { authApi } from "./auth-api";
import { getAccessToken } from "./tokens";
import type { GeoPosition } from "./geolocation";

export type DeliveryStatus = "PENDING" | "LOADED" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "CANCELLED";

export interface DeliveryZoneSummary {
  id: string;
  name: string;
}

export interface DeliveryDTO {
  id: string;
  number: string;
  status: DeliveryStatus;
  address: string;
  scheduledAt: string | null;
  deliveredAt: string | null;
  feeAmount: number;
  weightKg: number | null;
  failureReason: string | null;
  zone: DeliveryZoneSummary | null;
  customer: { id: string; name: string; phone: string | null } | null;
  statusHistory: { status: DeliveryStatus; changedAt: string; notes: string | null }[];
}

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

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = () => fetch(`${API_URL}${path}`, { ...options, headers: buildHeaders(options.headers as Record<string, string>) });

  let res = await send();
  if (res.status === 401 && (await authApi.refresh())) res = await send();

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || `Request to ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const deliveryApi = {
  listMine: () => apiFetch<DeliveryDTO[]>("/logistics/deliveries/mine"),
  findOne: (id: string) => apiFetch<DeliveryDTO>(`/logistics/deliveries/${id}`),

  updateStatus: (
    id: string,
    status: "LOADED" | "IN_TRANSIT" | "FAILED" | "CANCELLED",
    notes?: string,
    lostValue?: number,
    position?: GeoPosition | null,
  ) =>
    apiFetch<DeliveryDTO>(`/logistics/deliveries/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes, lostValue, latitude: position?.latitude, longitude: position?.longitude }),
    }),

  submitProofOfDelivery: (id: string, method: "SIGNATURE" | "QR_SCAN", reference: string, notes?: string, position?: GeoPosition | null) =>
    apiFetch<DeliveryDTO>(`/logistics/deliveries/${id}/proof-of-delivery`, {
      method: "POST",
      body: JSON.stringify({ method, reference, notes, latitude: position?.latitude, longitude: position?.longitude }),
    }),
};
