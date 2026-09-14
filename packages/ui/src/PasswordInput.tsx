"use client";

import { useId, useState } from "react";
import {
  scorePassword,
  STRENGTH_LEVEL_KEYS,
  STRENGTH_LEVEL_COLORS,
  type PasswordMissingCriterion,
} from "./password-strength";

export interface PasswordInputLabels {
  show: string;
  hide: string;
  levels: Record<(typeof STRENGTH_LEVEL_KEYS)[number], string>;
  hints: Record<PasswordMissingCriterion, string>;
}

const DEFAULT_LABELS: PasswordInputLabels = {
  show: "Show password",
  hide: "Hide password",
  levels: {
    veryWeak: "Very weak",
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
    veryStrong: "Very strong",
  },
  hints: {
    length6: "Use at least 6 characters",
    length8: "Use at least 8 characters",
    length12: "Use at least 12 characters",
    lowercase: "Add a lowercase letter",
    uppercase: "Add an uppercase letter",
    digit: "Add a digit",
    special: "Add a special character (@#$!%*?&...)",
    notRepetitive: "Avoid repeating the same character",
  },
};

export interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  /** Show the strength meter + hints below the field. Off for "current password" fields where robustness is moot. */
  showStrength?: boolean;
  /** Partial override — merged over the built-in English defaults, e.g. with @ixoris/i18n strings. */
  labels?: Partial<PasswordInputLabels>;
  /** Full className override for the <input>; falls back to the app-neutral default styling below. */
  inputClassName?: string;
  className?: string;
}

const DEFAULT_INPUT_CLASSNAME =
  "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 pr-10 text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  required,
  disabled,
  showStrength = true,
  labels,
  inputClassName,
  className,
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  const merged: PasswordInputLabels = {
    show: labels?.show ?? DEFAULT_LABELS.show,
    hide: labels?.hide ?? DEFAULT_LABELS.hide,
    levels: { ...DEFAULT_LABELS.levels, ...labels?.levels },
    hints: { ...DEFAULT_LABELS.hints, ...labels?.hints },
  };

  const result = showStrength && value.length > 0 ? scorePassword(value) : null;

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName ?? DEFAULT_INPUT_CLASSNAME}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? merged.hide : merged.show}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {result && (
        <div className="mt-1.5 space-y-1">
          <div className="flex gap-1">
            {STRENGTH_LEVEL_KEYS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= result.level ? STRENGTH_LEVEL_COLORS[result.level] : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {merged.levels[STRENGTH_LEVEL_KEYS[result.level]]}
          </p>
          {result.missing.length > 0 && (
            <ul className="list-inside list-disc text-xs text-slate-400 dark:text-slate-500">
              {result.missing.map((criterion) => (
                <li key={criterion}>{merged.hints[criterion]}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
      />
      <circle cx="10" cy="10" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
      />
      <circle cx="10" cy="10" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M2.5 2.5l15 15" />
    </svg>
  );
}
