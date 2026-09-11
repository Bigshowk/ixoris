import { withStore } from "./db";

export interface QueuedMutation {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  /** Lets the caller correlate a queued mutation back to optimistic UI state (e.g. a cart id). */
  tag?: string;
}

export interface ReplayResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

/**
 * Persists POS mutations (add to cart, checkout...) in IndexedDB while offline,
 * then replays them in order once connectivity returns. The server stays the
 * single source of truth — this is a durable outbox, not a local database.
 */
export class SyncQueue {
  constructor(private readonly dbName = "ixoris-pos-sync") {}

  async enqueue(mutation: Omit<QueuedMutation, "id" | "createdAt">): Promise<QueuedMutation> {
    const record: QueuedMutation = {
      ...mutation,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await withStore(this.dbName, "readwrite", (store) => store.add(record));
    return record;
  }

  async list(): Promise<QueuedMutation[]> {
    return withStore<QueuedMutation[]>(this.dbName, "readonly", (store) => store.getAll() as IDBRequest<QueuedMutation[]>);
  }

  async remove(id: string): Promise<void> {
    await withStore(this.dbName, "readwrite", (store) => store.delete(id));
  }

  async clear(): Promise<void> {
    await withStore(this.dbName, "readwrite", (store) => store.clear());
  }

  /**
   * Replays queued mutations in FIFO order via `send`. Stops at the first
   * failure so a later mutation can't apply out of order (e.g. checkout
   * before its cart's item additions).
   */
  async replay(send: (mutation: QueuedMutation) => Promise<Response>): Promise<ReplayResult> {
    const pending = (await this.list()).sort((a, b) => a.createdAt - b.createdAt);
    const result: ReplayResult = { succeeded: [], failed: [] };

    for (const mutation of pending) {
      try {
        const response = await send(mutation);
        if (!response.ok) {
          result.failed.push({ id: mutation.id, error: `HTTP ${response.status}` });
          break;
        }
        await this.remove(mutation.id);
        result.succeeded.push(mutation.id);
      } catch (err) {
        result.failed.push({ id: mutation.id, error: err instanceof Error ? err.message : String(err) });
        break;
      }
    }

    return result;
  }
}
