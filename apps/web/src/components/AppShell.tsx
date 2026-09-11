"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../lib/i18n-context";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleToggle } from "./LocaleToggle";
import { NotificationBell } from "./NotificationBell";
import { AuthUser } from "../lib/auth-api";

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: "📊" },
  { href: "/comptabilite", labelKey: "nav.accounting", icon: "🧾" },
  { href: "/paie", labelKey: "nav.payroll", icon: "💰" },
  { href: "/rh", labelKey: "nav.hr", icon: "🧑‍💼" },
  { href: "/crm", labelKey: "nav.crm", icon: "🤝" },
  { href: "/stock", labelKey: "nav.stock", icon: "📦" },
  { href: "/achats", labelKey: "nav.purchasing", icon: "🛒" },
  { href: "/logistique", labelKey: "nav.logistics", icon: "🚚" },
  { href: "/tresorerie", labelKey: "nav.treasury", icon: "🏦" },
  { href: "/credit", labelKey: "nav.credit", icon: "⏳" },
  { href: "/actifs", labelKey: "nav.assets", icon: "🏭" },
  { href: "/documents", labelKey: "nav.documents", icon: "📎" },
  { href: "/admin", labelKey: "nav.admin", icon: "⚙️" },
];

export interface AppShellProps {
  user: AuthUser;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AppShell({ user, onLogout, children }: AppShellProps) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 py-4 text-base font-semibold text-slate-900 dark:text-white">{t("web.appTitle")}</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {user.firstName} {user.lastName}
            </span>
            <NotificationBell />
            <LocaleToggle />
            <ThemeToggle />
            <button
              type="button"
              onClick={onLogout}
              className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              {t("common.logout")}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
