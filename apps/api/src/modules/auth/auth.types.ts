export interface AccessTokenPayload {
  sub: string; // userId
  companyId: string | null;
  email: string;
}

/** Short-lived token issued in place of real tokens when a password check succeeds but MFA is still pending. */
export interface MfaChallengePayload {
  sub: string; // userId
  mfaPending: true;
}
