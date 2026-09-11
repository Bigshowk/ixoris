import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { I18nProvider } from "../lib/i18n-context";

export const metadata: Metadata = {
  title: "IXORIS Back-office",
  description: "IXORIS ERP — back-office : comptabilité, RH/paie, CRM, stock, trésorerie",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <ThemeInitScript />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

/** Applies the stored theme class before first paint — avoids a flash of the wrong theme on load. */
function ThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try {
  var pref = localStorage.getItem('ixoris-web-theme') || 'system';
  var effective = pref === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref;
  if (effective === 'dark') document.documentElement.classList.add('dark');
} catch (e) {}`,
      }}
    />
  );
}
