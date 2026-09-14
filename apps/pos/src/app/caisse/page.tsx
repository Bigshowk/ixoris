"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartDTO, ProductSummary, SaleDTO, TenderInput } from "@ixoris/types";
import { api, ApiError } from "../../lib/api";
import { getDeviceId, getSession, clearSession, PosSession } from "../../lib/session";
import { authApi } from "../../lib/auth-api";
import { useHidScanner } from "../../hooks/useHidScanner";
import { usePosSocket } from "../../hooks/usePosSocket";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { CameraScanner } from "../../components/CameraScanner";
import { CartPanel } from "../../components/CartPanel";
import { CheckoutModal } from "../../components/CheckoutModal";
import { ActiveCartsDrawer } from "../../components/ActiveCartsDrawer";
import { LoginScreen } from "../../components/LoginScreen";
import { ThemeToggle } from "../../components/ThemeToggle";
import { LocaleToggle } from "../../components/LocaleToggle";
import { isWebUsbSupported, printViaUsb } from "../../lib/print";
import { formatMoney } from "../../lib/format";
import { useI18n } from "../../lib/i18n-context";

const CART_ID_KEY = "ixoris-pos-cart-id";

export default function CaissePage() {
  const { t } = useI18n();
  const [session, setSession] = useState<PosSession | null>(null);
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSummary[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastSale, setLastSale] = useState<SaleDTO | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [printerHost, setPrinterHost] = useState("");
  const [activeCarts, setActiveCarts] = useState<CartDTO[]>([]);
  const [cartsDrawerOpen, setCartsDrawerOpen] = useState(false);
  const [mfaGate, setMfaGate] = useState(false);

  const cartRef = useRef<CartDTO | null>(null);
  cartRef.current = cart;

  useEffect(() => {
    setSession(getSession());
  }, []);

  // MFA setup itself only lives in apps/web — a device whose account is required to have
  // MFA but hasn't set it up yet is blocked here rather than left able to keep using the till.
  useEffect(() => {
    if (!session) return;
    authApi
      .me()
      .then((me) => setMfaGate(Boolean(me.user.mfaRequired) && !me.user.mfaEnabled))
      .catch(() => {});
  }, [session]);

  const reconcileCart = useCallback(async () => {
    if (cartRef.current) {
      const fresh = await api.getCart(cartRef.current.id).catch(() => null);
      if (fresh) setCart(fresh);
    }
  }, []);

  const { online, pendingCount, queueMutation } = useOfflineSync(reconcileCart);

  const loadActiveCarts = useCallback(async () => {
    if (!session) return;
    const carts = await api.listActiveCarts(session.storeId).catch(() => []);
    setActiveCarts(carts);
  }, [session]);

  useEffect(() => {
    loadActiveCarts();
  }, [loadActiveCarts]);

  // --- Cart bootstrap: resume the device's cart, or start a fresh one -------------
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function bootstrap() {
      const storedCartId = window.localStorage.getItem(CART_ID_KEY);
      if (storedCartId) {
        const existing = await api.getCart(storedCartId).catch(() => null);
        if (existing && existing.status === "ACTIVE" && !cancelled) {
          setCart(existing);
          return;
        }
      }
      const created = await api.createCart({ storeId: session!.storeId, deviceId: getDeviceId() });
      if (!cancelled) {
        window.localStorage.setItem(CART_ID_KEY, created.id);
        setCart(created);
      }
    }

    bootstrap().catch((err) => setMessage(err instanceof Error ? err.message : "Erreur d'initialisation"));
    return () => {
      cancelled = true;
    };
  }, [session]);

  // --- Realtime: a cart edited from another device (e.g. phone -> till) lands here,
  // and keeps the store-wide "active carts" list live regardless of which device created it --
  usePosSocket({
    storeId: session?.storeId ?? null,
    onCartUpdated: (updated) => {
      if (updated.id === cartRef.current?.id) setCart(updated);
      setActiveCarts((prev) => {
        if (updated.status !== "ACTIVE") return prev.filter((c) => c.id !== updated.id);
        const idx = prev.findIndex((c) => c.id === updated.id);
        if (idx === -1) return [updated, ...prev];
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    },
    // A sale completed anywhere in the store converts its cart — refresh so it drops off every screen's list.
    onSaleCompleted: () => {
      loadActiveCarts();
    },
  });

  // --- Scan handling: camera + HID douchette funnel into the same handler --------
  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    try {
      const product = await api.findProductByBarcode(barcode);
      await addProductToCart(product);
    } catch (err) {
      setMessage(err instanceof ApiError && err.status === 404 ? `${t("errors.genericTitle")}: ${barcode}` : t("errors.networkError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHidScanner(handleBarcodeScanned, { enabled: true });

  async function addProductToCart(product: ProductSummary, quantity = 1) {
    const current = cartRef.current;
    if (!current) return;

    const input = { productId: product.id, quantity, discount: 0 };

    if (online) {
      try {
        const updated = await api.addCartItem(current.id, input);
        setCart(updated);
        return;
      } catch {
        // fall through to offline path — request failed even though navigator says online
      }
    }

    optimisticAddItem(product, quantity);
    await queueMutation({ method: "POST", url: `/pos/carts/${current.id}/items`, body: input, tag: current.id });
  }

  function optimisticAddItem(product: ProductSummary, quantity: number) {
    setCart((prev) => {
      if (!prev) return prev;
      const lineSubtotal = quantity * product.sellingPrice;
      const total = Math.round(lineSubtotal * (1 + product.tvaRate / 100) * 100) / 100;
      const items = [
        ...prev.items,
        {
          id: `temp-${crypto.randomUUID()}`,
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.sellingPrice,
          discount: 0,
          tvaRate: product.tvaRate,
          total,
        },
      ];
      return {
        ...prev,
        items,
        subtotal: round2(prev.subtotal + lineSubtotal),
        tvaTotal: round2(prev.tvaTotal + (total - lineSubtotal)),
        total: round2(prev.total + total),
      };
    });
  }

  async function handleIncrement(itemId: string, quantity: number) {
    if (!cart) return;
    if (quantity <= 0) return handleRemove(itemId);
    const updated = await api.updateCartItem(cart.id, itemId, { quantity }).catch(() => null);
    if (updated) setCart(updated);
  }

  async function handleRemove(itemId: string) {
    if (!cart) return;
    const updated = await api.removeCartItem(cart.id, itemId).catch(() => null);
    if (updated) setCart(updated);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const results = await api.searchProducts(query).catch(() => []);
    setSearchResults(results);
  }

  async function confirmCheckout(payments: TenderInput[]) {
    if (!cart) return;
    setCheckingOut(true);
    try {
      const sale = await api.checkout({ cartId: cart.id, registerId: session?.registerId, payments });
      setLastSale(sale);
      setCheckoutOpen(false);
      window.localStorage.removeItem(CART_ID_KEY);
      const fresh = await api.createCart({ storeId: session!.storeId, deviceId: getDeviceId() });
      window.localStorage.setItem(CART_ID_KEY, fresh.id);
      setCart(fresh);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Échec de l'encaissement");
    } finally {
      setCheckingOut(false);
    }
  }

  /** Switches this device to a cart selected from the "active carts" drawer — including one started on another device. */
  function handleResumeCart(target: CartDTO) {
    window.localStorage.setItem(CART_ID_KEY, target.id);
    setCart(target);
    setCartsDrawerOpen(false);
  }

  async function handlePrintUsb() {
    if (!lastSale) return;
    try {
      const bytes = await api.getTicketBytes(lastSale.id);
      await printViaUsb(bytes);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impression USB impossible");
    }
  }

  async function handlePrintNetwork() {
    if (!lastSale || !printerHost) return;
    try {
      await api.printTicket(lastSale.id, printerHost);
      setMessage("Ticket envoyé à l'imprimante");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impression réseau impossible");
    }
  }

  async function handleLogout() {
    await authApi.logout();
    clearSession();
    window.localStorage.removeItem(CART_ID_KEY);
    setSession(null);
    setCart(null);
  }

  if (!session) {
    return <LoginScreen onReady={() => setSession(getSession())} />;
  }

  if (mfaGate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm space-y-2 rounded-xl bg-white p-6 text-center shadow-xl dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("auth.mfa.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("profile.mfaSection.gateMessage")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h1 className="text-lg font-semibold">{t("pos.title")}</h1>
        <div className="flex items-center gap-3 text-xs">
          {!online && <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-700 dark:text-amber-300">{t("pos.offline")}</span>}
          {pendingCount > 0 && (
            <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {pendingCount} {t("pos.pendingSync")}
            </span>
          )}
          <button
            className="relative rounded-full bg-slate-200 px-3 py-1 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
            onClick={() => {
              loadActiveCarts();
              setCartsDrawerOpen(true);
            }}
          >
            🧺 {t("pos.activeCarts.button")}
            {activeCarts.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{activeCarts.length}</span>
            )}
          </button>
          <LocaleToggle />
          <ThemeToggle />
          <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={handleLogout}>
            {t("common.logout")}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <section className="flex w-full max-w-md flex-col border-r border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-3 flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder={t("pos.scanPrompt")}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button
              className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
              onClick={() => setCameraActive((v) => !v)}
            >
              📷
            </button>
          </div>

          <CameraScanner active={cameraActive} onDetected={handleBarcodeScanned} />

          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              {searchResults.map((product) => (
                <li key={product.id}>
                  <button
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => addProductToCart(product)}
                  >
                    <span>{product.name}</span>
                    <span className="text-slate-500 dark:text-slate-400">{formatMoney(product.sellingPrice)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {message && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{message}</p>}
        </section>

        <section className="flex flex-1 flex-col">
          <CartPanel cart={cart} onIncrement={handleIncrement} onRemove={handleRemove} />

          {cart && cart.items.length > 0 && (
            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 flex justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>{t("pos.subtotal")}</span>
                <span>{formatMoney(cart.subtotal)}</span>
              </div>
              <div className="mb-3 flex justify-between text-lg font-semibold">
                <span>{t("pos.total")}</span>
                <span>{formatMoney(cart.total)}</span>
              </div>
              <button
                className="w-full rounded-lg bg-emerald-500 py-3 font-medium text-slate-950 hover:bg-emerald-400"
                onClick={() => setCheckoutOpen(true)}
              >
                {t("pos.checkout")}
              </button>
            </div>
          )}
        </section>
      </div>

      {checkoutOpen && cart && (
        <CheckoutModal cart={cart} submitting={checkingOut} onClose={() => setCheckoutOpen(false)} onConfirm={confirmCheckout} />
      )}

      {cartsDrawerOpen && (
        <ActiveCartsDrawer
          carts={activeCarts}
          currentCartId={cart?.id ?? null}
          onResume={handleResumeCart}
          onClose={() => setCartsDrawerOpen(false)}
        />
      )}

      {lastSale && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-emerald-800 bg-emerald-50 p-4 dark:bg-emerald-950/95">
          <p className="text-sm">
            {lastSale.number} — {formatMoney(lastSale.total, lastSale.currencyCode)}
            {lastSale.changeDue > 0 ? ` (${t("pos.changeDue")}: ${formatMoney(lastSale.changeDue, lastSale.currencyCode)})` : ""}
          </p>
          <div className="flex items-center gap-2">
            {isWebUsbSupported() && (
              <button className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700" onClick={handlePrintUsb}>
                {t("pos.printUsb")}
              </button>
            )}
            <input
              className="w-32 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder={t("pos.printerIp")}
              value={printerHost}
              onChange={(e) => setPrinterHost(e.target.value)}
            />
            <button className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700" onClick={handlePrintNetwork}>
              {t("pos.printNetwork")}
            </button>
            <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => setLastSale(null)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
