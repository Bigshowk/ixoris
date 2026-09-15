"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { CartDTO, SaleDTO } from "@ixoris/types";
import { WS_URL } from "../lib/config";
import { getAccessToken } from "../lib/tokens";

export interface UsePosSocketOptions {
  storeId: string | null;
  onCartUpdated?: (cart: CartDTO) => void;
  onSaleCompleted?: (sale: SaleDTO) => void;
}

/**
 * Keeps every terminal in a store in sync: a cart started on a phone shows up
 * live on the till, and a completed sale notifies whoever is watching it.
 */
export function usePosSocket({ storeId, onCartUpdated, onSaleCompleted }: UsePosSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onCartUpdatedRef = useRef(onCartUpdated);
  const onSaleCompletedRef = useRef(onSaleCompleted);
  onCartUpdatedRef.current = onCartUpdated;
  onSaleCompletedRef.current = onSaleCompleted;

  useEffect(() => {
    if (!storeId) return;

    // The gateway now requires the same bearer token as the REST API (see apps/api's PosGateway) —
    // without it, the connection is refused before it can join any store room.
    const socket = io(`${WS_URL}/pos`, { transports: ["websocket"], auth: { token: getAccessToken() } });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join:store", { storeId }));
    socket.on("cart:updated", (event: { cart: CartDTO }) => onCartUpdatedRef.current?.(event.cart));
    socket.on("sale:completed", (event: { sale: SaleDTO }) => onSaleCompletedRef.current?.(event.sale));

    return () => {
      socket.emit("leave:store", { storeId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [storeId]);
}
