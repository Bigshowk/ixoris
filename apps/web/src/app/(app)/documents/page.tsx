"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n-context";
import { formatDate } from "../../../lib/format";
import { SectionTabs } from "../../../components/SectionTabs";

type AttachableType = "JournalEntry" | "Invoice" | "Employee" | "FixedAsset" | "PurchaseOrder";

const ATTACHABLE_TYPES: AttachableType[] = ["JournalEntry", "Invoice", "Employee", "FixedAsset", "PurchaseOrder"];

interface DocItem {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  createdAt: string;
  uploadedById: string | null;
}

interface PickerItem {
  id: string;
  label: string;
}

export default function DocumentsLibraryPage() {
  const { t } = useI18n();
  const [attachableType, setAttachableType] = useState<AttachableType>("PurchaseOrder");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [attachableId, setAttachableId] = useState("");
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadItems(attachableType);
    setAttachableId("");
    setDocs(null);
  }, [attachableType]);

  function loadItems(type: AttachableType) {
    if (type === "JournalEntry") {
      apiFetch<{ id: string; reference: string; description: string | null }[]>("/accounting/journal-entries")
        .then((rows) => setItems(rows.map((r) => ({ id: r.id, label: `${r.reference}${r.description ? ` — ${r.description}` : ""}` }))))
        .catch(() => setItems([]));
    } else if (type === "Invoice") {
      apiFetch<{ id: string; number: string }[]>("/accounting/invoices")
        .then((rows) => setItems(rows.map((r) => ({ id: r.id, label: r.number }))))
        .catch(() => setItems([]));
    } else if (type === "Employee") {
      apiFetch<{ id: string; employeeNumber: string; firstName: string; lastName: string }[]>("/hr/employees")
        .then((rows) => setItems(rows.map((r) => ({ id: r.id, label: `${r.employeeNumber} — ${r.firstName} ${r.lastName}` }))))
        .catch(() => setItems([]));
    } else if (type === "FixedAsset") {
      apiFetch<{ id: string; code: string; name: string }[]>("/fixed-assets")
        .then((rows) => setItems(rows.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))))
        .catch(() => setItems([]));
    } else if (type === "PurchaseOrder") {
      apiFetch<{ id: string; number: string }[]>("/supply-chain/purchase-orders")
        .then((rows) => setItems(rows.map((r) => ({ id: r.id, label: r.number }))))
        .catch(() => setItems([]));
    }
  }

  function selectItem(id: string) {
    setAttachableId(id);
    setActionError(null);
    if (!id) {
      setDocs(null);
      return;
    }
    apiFetch<DocItem[]>(`/documents?attachableType=${attachableType}&attachableId=${id}`)
      .then(setDocs)
      .catch((err) => setListError(err instanceof ApiError ? err.message : t("errors.networkError")));
  }

  async function handleAttach() {
    setFormError(null);
    if (!attachableId || !fileName || !fileUrl) {
      setFormError(t("errors.required"));
      return;
    }
    try {
      await apiFetch("/documents", {
        method: "POST",
        body: JSON.stringify({ fileName, fileUrl, mimeType: mimeType || undefined, attachableType, attachableId }),
      });
      setFileName("");
      setFileUrl("");
      setMimeType("");
      selectItem(attachableId);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" });
      selectItem(attachableId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.networkError"));
    }
  }

  return (
    <div>
      <SectionTabs
        tabs={[
          { href: "/documents", label: t("documents.tabs.library") },
          { href: "/documents/approbations", label: t("documents.tabs.approvals") },
        ]}
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={attachableType}
            onChange={(e) => setAttachableType(e.target.value as AttachableType)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {ATTACHABLE_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`documents.library.types.${tp}`)}
              </option>
            ))}
          </select>
          <select
            value={attachableId}
            onChange={(e) => selectItem(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("documents.library.selectItem")}</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.label}
              </option>
            ))}
          </select>
        </div>

        {attachableId && (
          <>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                placeholder={t("documents.library.fileName")}
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                placeholder={t("documents.library.fileUrl")}
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                placeholder={t("documents.library.mimeType")}
                value={mimeType}
                onChange={(e) => setMimeType(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            {formError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{formError}</p>}
            <button onClick={handleAttach} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              {t("documents.library.attach")}
            </button>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {!attachableId && <p className="text-sm text-slate-500 dark:text-slate-400">{t("documents.library.selectTypeAndItem")}</p>}
        {attachableId && (
          <>
            {actionError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{actionError}</p>}
            {listError && <p className="text-sm text-red-500 dark:text-red-400">{listError}</p>}
            {!listError && !docs && <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>}
            {docs && docs.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("documents.library.noDocuments")}</p>}
            {docs && docs.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">
                      {d.fileName}
                    </a>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(d.createdAt)}</span>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        {t("documents.library.delete")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
