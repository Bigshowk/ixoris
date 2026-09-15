const NAVY = "#132A46";
const GOLD = "#C9973A";

/**
 * Monogram geometry (0..140 viewBox) — a 270° open ring breaking into an ascending
 * arrow, evoking full-circle integration + growth. Kept as one shared source of truth:
 * the ESC/POS thermal-ticket raster logo (packages/escpos) was generated from these
 * same coordinates, so any change here should be mirrored there.
 */
function Mark() {
  return (
    <svg viewBox="0 0 140 140" width="100%" height="100%" aria-hidden="true">
      <rect x="0" y="0" width="140" height="140" rx="28" fill={NAVY} />
      <path
        d="M106.25 86.9 A40 40 0 1 1 86.9 33.75"
        fill="none"
        stroke={GOLD}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M86.9 33.75 L96.2 13.8" fill="none" stroke={GOLD} strokeWidth="7" strokeLinecap="round" />
      <polygon points="101.3,2.9 105.15,13.58 90.65,6.82" fill={GOLD} />
    </svg>
  );
}

export interface IxorisLogoProps {
  /** "mark" = monogram only (compact spaces). "full" = monogram + wordmark. Default "full". */
  variant?: "mark" | "full";
  /** Adds the "Progiciel de gestion intégré" baseline + KADERSYS signature below the wordmark. */
  tagline?: boolean;
  className?: string;
}

/**
 * Official IXORIS ERP logo — validated concept, see /a-propos for the publisher credit.
 * Wordmark/tagline text use `currentColor` so they stay legible in dark mode; wrap with a
 * text color class (e.g. "text-slate-900 dark:text-white") the way `web.appTitle` used to be.
 */
export function IxorisLogo({ variant = "full", tagline = false, className }: IxorisLogoProps) {
  if (variant === "mark") {
    return (
      <span className={className} style={{ display: "inline-block", width: "2rem", height: "2rem" }}>
        <Mark />
      </span>
    );
  }

  if (tagline) {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "0.85rem" }}>
        <span style={{ width: "3.5rem", height: "3.5rem", flexShrink: 0 }}>
          <Mark />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 500, letterSpacing: "0.05em" }}>IXORIS</span>
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", opacity: 0.65 }}>
            PROGICIEL DE GESTION INTÉGRÉ
          </span>
          <span style={{ fontSize: "0.6rem", letterSpacing: "0.06em", opacity: 0.5 }}>
            par KADERSYS SOFTWARE SYSTEMS
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ width: "1.75rem", height: "1.75rem", flexShrink: 0 }}>
        <Mark />
      </span>
      <span style={{ fontSize: "1.05rem", fontWeight: 500, letterSpacing: "0.03em" }}>IXORIS</span>
    </span>
  );
}
