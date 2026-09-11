"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useI18n } from "../lib/i18n-context";
import { formatDate } from "../lib/format";

type Severity = "INFO" | "WARNING" | "CRITICAL";

interface NotificationItem {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const POLL_MS = 30_000;

const SEVERITY_STYLES: Record<Severity, string> = {
  INFO: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  WARNING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

/** Bell + dropdown fed by GET /notifications, polled every 30s so a badge count stays live without a page reload. */
export function NotificationBell() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(() => {
    apiFetch<{ count: number }>("/notifications/unread-count")
      .then((r) => setUnreadCount(r.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, POLL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      apiFetch<NotificationItem[]>("/notifications").then(setNotifications).catch(() => {});
    }
  }

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    loadUnreadCount();
  }

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "POST" }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        onClick={toggleOpen}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{t("notifications.title")}</span>
              {unreadCount > 0 && (
                <button type="button" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400" onClick={markAllRead}>
                  {t("notifications.markAllRead")}
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{t("notifications.empty")}</p>}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-slate-100 px-3 py-2 dark:border-slate-800 ${!n.isRead ? "bg-indigo-50/50 dark:bg-indigo-500/5" : ""}`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_STYLES[n.severity]}`}>{n.severity}</span>
                    <span className="text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                  {!n.isRead && (
                    <button type="button" className="mt-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => markRead(n.id)}>
                      {t("notifications.markRead")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
