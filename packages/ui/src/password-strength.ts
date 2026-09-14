export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

export type PasswordMissingCriterion =
  | "length6"
  | "length8"
  | "length12"
  | "lowercase"
  | "uppercase"
  | "digit"
  | "special"
  | "notRepetitive";

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  missing: PasswordMissingCriterion[];
}

export const STRENGTH_LEVEL_KEYS = ["veryWeak", "weak", "medium", "strong", "veryStrong"] as const;

export const STRENGTH_LEVEL_COLORS: Record<PasswordStrengthLevel, string> = {
  0: "bg-red-500",
  1: "bg-orange-500",
  2: "bg-yellow-500",
  3: "bg-green-500",
  4: "bg-blue-500",
};

const SPECIAL_RE = /[^A-Za-z0-9]/;
const REPETITIVE_RE = /^(.)\1+$/;

interface Signals {
  length: number;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  isRepetitive: boolean;
}

function analyze(password: string): Signals {
  return {
    length: password.length,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: SPECIAL_RE.test(password),
    isRepetitive: password.length > 1 && REPETITIVE_RE.test(password),
  };
}

function levelFor(s: Signals): PasswordStrengthLevel {
  if (s.length < 6 || s.isRepetitive) return 0;
  const hasLetter = s.hasLower || s.hasUpper;
  const hasBothCases = s.hasLower && s.hasUpper;
  if (hasBothCases && s.hasDigit && s.hasSpecial && s.length >= 12) return 4;
  if (hasBothCases && s.hasDigit && s.length >= 8) return 3;
  if (hasLetter && s.hasDigit) return 2;
  if (hasLetter) return 1;
  return 0;
}

/** Only the criteria still missing to reach the *next* level up — an actionable checklist, not a static requirements dump. */
function missingFor(s: Signals, level: PasswordStrengthLevel): PasswordMissingCriterion[] {
  if (level >= 4) return [];
  const missing: PasswordMissingCriterion[] = [];
  if (s.length < 6) missing.push("length6");
  if (s.isRepetitive) missing.push("notRepetitive");
  if (!s.hasLower) missing.push("lowercase");
  if (!s.hasUpper) missing.push("uppercase");
  if (!s.hasDigit) missing.push("digit");
  if (level >= 2 && s.length < 8) missing.push("length8");
  if (level >= 3) {
    if (!s.hasSpecial) missing.push("special");
    if (s.length < 12) missing.push("length12");
  }
  return missing;
}

export function scorePassword(password: string): PasswordStrengthResult {
  const s = analyze(password);
  const level = levelFor(s);
  return { level, missing: missingFor(s, level) };
}
