"use client";

import { FormEvent, useEffect, useState } from "react";
import { PasswordInput } from "@ixoris/ui";
import { authApi, AuthUser } from "../../../lib/auth-api";
import { useI18n } from "../../../lib/i18n-context";
import { TotpQrCode } from "../../../components/TotpQrCode";

type MfaSetupState = { secret: string; otpauthUrl: string } | null;

export default function ProfilPage() {
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [mfaSetup, setMfaSetup] = useState<MfaSetupState>(null);
  const [mfaConfirmCode, setMfaConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => {
    authApi
      .me()
      .then((me) => setUser(me.user))
      .catch(() => {});
  }, []);

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: t("profile.passwordSection.mismatch") });
      return;
    }
    setPasswordSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: "success", text: t("profile.passwordSection.success") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: t("profile.passwordSection.error") });
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleStartMfaSetup() {
    setMfaError(null);
    try {
      setMfaSetup(await authApi.setupMfa());
    } catch {
      setMfaError(t("profile.mfaSection.setupError"));
    }
  }

  async function handleConfirmMfa(event: FormEvent) {
    event.preventDefault();
    setMfaError(null);
    setMfaSubmitting(true);
    try {
      const result = await authApi.enableMfa(mfaConfirmCode);
      setBackupCodes(result.backupCodes);
      setMfaSetup(null);
      setMfaConfirmCode("");
    } catch {
      setMfaError(t("profile.mfaSection.enableError"));
    } finally {
      setMfaSubmitting(false);
    }
  }

  async function handleDisableMfa(event: FormEvent) {
    event.preventDefault();
    setMfaError(null);
    setMfaSubmitting(true);
    try {
      await authApi.disableMfa(disablePassword, disableCode);
      // A full reload is the simplest way to get AppLayout's user state (and the MFA-required
      // gate it drives) back in sync — this page fetches its own copy independently.
      window.location.reload();
    } catch {
      setMfaError(t("profile.mfaSection.disableError"));
      setMfaSubmitting(false);
    }
  }

  function handleBackupCodesDone() {
    window.location.reload();
  }

  if (!user) return <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</p>;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("profile.title")}</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("profile.passwordSection.title")}</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            {t("profile.passwordSection.current")}
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              required
              showStrength={false}
              autoComplete="current-password"
              labels={{ show: t("auth.passwordField.show"), hide: t("auth.passwordField.hide") }}
            />
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            {t("profile.passwordSection.new")}
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              required
              autoComplete="new-password"
              labels={{
                show: t("auth.passwordField.show"),
                hide: t("auth.passwordField.hide"),
                levels: {
                  veryWeak: t("auth.passwordField.levels.veryWeak"),
                  weak: t("auth.passwordField.levels.weak"),
                  medium: t("auth.passwordField.levels.medium"),
                  strong: t("auth.passwordField.levels.strong"),
                  veryStrong: t("auth.passwordField.levels.veryStrong"),
                },
                hints: {
                  length6: t("auth.passwordField.hints.length6"),
                  length8: t("auth.passwordField.hints.length8"),
                  length12: t("auth.passwordField.hints.length12"),
                  lowercase: t("auth.passwordField.hints.lowercase"),
                  uppercase: t("auth.passwordField.hints.uppercase"),
                  digit: t("auth.passwordField.hints.digit"),
                  special: t("auth.passwordField.hints.special"),
                  notRepetitive: t("auth.passwordField.hints.notRepetitive"),
                },
              }}
            />
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            {t("profile.passwordSection.confirm")}
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              showStrength={false}
              autoComplete="new-password"
              labels={{ show: t("auth.passwordField.show"), hide: t("auth.passwordField.hide") }}
            />
          </label>
          {passwordMessage && (
            <p
              className={`text-sm ${
                passwordMessage.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
              }`}
            >
              {passwordMessage.text}
            </p>
          )}
          <button
            type="submit"
            disabled={passwordSubmitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {t("profile.passwordSection.submit")}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("profile.mfaSection.title")}</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              user.mfaEnabled
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
            }`}
          >
            {user.mfaEnabled ? t("profile.mfaSection.enabled") : t("profile.mfaSection.disabled")}
          </span>
        </div>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{t("profile.mfaSection.description")}</p>
        {user.mfaRequired && !user.mfaEnabled && (
          <p className="mb-3 text-sm font-medium text-amber-600 dark:text-amber-400">{t("profile.mfaSection.required")}</p>
        )}

        {backupCodes && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t("profile.mfaSection.backupCodesTitle")}</h3>
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">{t("profile.mfaSection.backupCodesWarning")}</p>
            <div className="mb-3 grid grid-cols-2 gap-1 font-mono text-sm text-slate-900 dark:text-white">
              {backupCodes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </div>
            <button
              onClick={handleBackupCodesDone}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {t("profile.mfaSection.backupCodesDone")}
            </button>
          </div>
        )}

        {!backupCodes && !user.mfaEnabled && !mfaSetup && (
          <>
            {mfaError && <p className="mb-2 text-sm text-red-500 dark:text-red-400">{mfaError}</p>}
            <button
              onClick={handleStartMfaSetup}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {t("profile.mfaSection.enable")}
            </button>
          </>
        )}

        {!backupCodes && mfaSetup && (
          <form onSubmit={handleConfirmMfa} className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("profile.mfaSection.scanQr")}</p>
            <TotpQrCode otpauthUrl={mfaSetup.otpauthUrl} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("profile.mfaSection.manualEntry")} <span className="font-mono">{mfaSetup.secret}</span>
            </p>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              {t("profile.mfaSection.confirmCode")}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="mt-1 w-full max-w-[10rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-center text-lg tracking-widest text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                value={mfaConfirmCode}
                onChange={(e) => setMfaConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            {mfaError && <p className="text-sm text-red-500 dark:text-red-400">{mfaError}</p>}
            <button
              type="submit"
              disabled={mfaSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {t("profile.mfaSection.confirm")}
            </button>
          </form>
        )}

        {!backupCodes && user.mfaEnabled && !showDisableForm && (
          <button
            onClick={() => setShowDisableForm(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("profile.mfaSection.disable")}
          </button>
        )}

        {!backupCodes && user.mfaEnabled && showDisableForm && (
          <form onSubmit={handleDisableMfa} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("profile.mfaSection.disableConfirmTitle")}</h3>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              {t("profile.mfaSection.disablePasswordLabel")}
              <PasswordInput
                value={disablePassword}
                onChange={setDisablePassword}
                required
                showStrength={false}
                autoComplete="current-password"
                labels={{ show: t("auth.passwordField.show"), hide: t("auth.passwordField.hide") }}
              />
            </label>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              {t("profile.mfaSection.disableCodeLabel")}
              <input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                maxLength={12}
                required
                className="mt-1 w-full max-w-[12rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
              />
            </label>
            {mfaError && <p className="text-sm text-red-500 dark:text-red-400">{mfaError}</p>}
            <button
              type="submit"
              disabled={mfaSubmitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {t("profile.mfaSection.disableSubmit")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
