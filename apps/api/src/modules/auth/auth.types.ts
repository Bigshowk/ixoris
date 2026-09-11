export interface AccessTokenPayload {
  sub: string; // userId
  companyId: string | null;
  email: string;
}
