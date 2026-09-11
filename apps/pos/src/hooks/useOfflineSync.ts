"use client";

import { useCallback, useEffect, useState } from "react";
import { SyncQueue, subscribeOnlineStatus, type QueuedMutation } from "@ixoris/sync-client";
import { getSession } from "../lib/session";
import { API_URL } from "../lib/config";
import { authApi } from "../lib/auth-api";
import { getAccessToken } from "../lib/tokens";

const queue = new SyncQueue();

export interface UseOfflineSyncResult {
  online: boolean;
  pendingCount: number;
  queueMutation: (mutation: Omit<QueuedMutation, "id" | "createdAt">) => Promise<void>;
  flush: () => Promise<void>;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const session = getSession();
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (session) headers["x-store-id"] = session.storeId;
  return headers;
}

/**
 * Outbox for POS mutations made while offline. Optimistic UI updates happen
 * at the call site (see caisse page); this hook only owns durability +
 * replay-on-reconnect so a sale started with no signal is never lost.
 */
export function useOfflineSync(onFlushed?: () => void): UseOfflineSyncResult {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount((await queue.list()).length);
  }, []);

  const flush = useCallback(async () => {
    await queue.replay(async (mutation) => {
      const send = () =>
        fetch(`${API_URL}${mutation.url}`, {
          method: mutation.method,
          headers: buildHeaders(mutation.headers),
          body: mutation.body ? JSON.stringify(mutation.body) : undefined,
        });

      let res = await send();
      if (res.status === 401 && (await authApi.refresh())) res = await send();
      return res;
    });
    await refreshPendingCount();
    onFlushed?.();
  }, [onFlushed, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    const unsubscribe = subscribeOnlineStatus((isOnline) => {
      setOnline(isOnline);
      if (isOnline) flush();
    });
    return unsubscribe;
  }, [flush, refreshPendingCount]);

  const queueMutation = useCallback(
    async (mutation: Omit<QueuedMutation, "id" | "createdAt">) => {
      await queue.enqueue(mutation);
      await refreshPendingCount();
    },
    [refreshPendingCount],
  );

  return { online, pendingCount, queueMutation, flush };
}
