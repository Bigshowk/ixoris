import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { User } from "@ixoris/database";
import { MfaChallengePayload } from "./auth.types";
import {
  buildOtpauthUrl,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  verifyTotp,
} from "./mfa/totp.util";

const REFRESH_TOKEN_DAYS = parseDays(process.env.REFRESH_TOKEN_EXPIRES_IN, 30);
const MFA_CHALLENGE_EXPIRES_IN = "5m";
const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.mfaEnabled) {
      // Password is correct, but the caller doesn't get real tokens yet — just a short-lived
      // challenge scoped to /auth/mfa/verify, exchanged for real tokens once the code checks out.
      return { mfaRequired: true as const, mfaToken: await this.signMfaChallengeToken(user.id) };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      mfaRequired: false as const,
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
      user: this.toPublicUser(user),
    };
  }

  async verifyMfaLogin(mfaToken: string, code: string) {
    let payload: MfaChallengePayload;
    try {
      payload = await this.jwt.verifyAsync<MfaChallengePayload>(mfaToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired MFA challenge");
    }
    if (!payload.mfaPending) throw new UnauthorizedException("Invalid or expired MFA challenge");

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!user.isActive) throw new UnauthorizedException("Account disabled");
    if (!user.mfaEnabled || !user.mfaSecret) throw new UnauthorizedException("MFA is not enabled on this account");

    await this.consumeMfaCode(user.id, user.mfaSecret, user.mfaBackupCodeHashes, code);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
      user: this.toPublicUser(user),
    };
  }

  /** Generates a fresh secret (not yet trusted — `mfaEnabled` stays false until `enableMfa` confirms a code). */
  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });
    return { secret, otpauthUrl: buildOtpauthUrl(secret, user.email) };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) throw new BadRequestException("Call /auth/mfa/setup first");
    if (!verifyTotp(user.mfaSecret, code)) throw new UnauthorizedException("Invalid or expired code");

    const backupCodes = generateBackupCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaBackupCodeHashes: backupCodes.map(hashBackupCode) },
    });
    // Plaintext codes are never stored — this is the only time the caller can see them.
    return { backupCodes };
  }

  async disableMfa(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!bcrypt.compareSync(password, user.passwordHash)) throw new UnauthorizedException("Invalid password");
    if (!user.mfaSecret) throw new BadRequestException("MFA is not enabled");
    await this.consumeMfaCode(userId, user.mfaSecret, user.mfaBackupCodeHashes, code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodeHashes: [] },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException("Invalid current password");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: bcrypt.hashSync(newPassword, BCRYPT_COST) },
    });
    // Changing the password is a security-sensitive action — revoke every other active
    // session so a refresh token stolen before the change stops working immediately.
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Verifies a TOTP code, falling back to a single-use backup code (its hash is removed once consumed). */
  private async consumeMfaCode(userId: string, secret: string, backupCodeHashes: string[], code: string) {
    if (verifyTotp(secret, code)) return;

    const hash = hashBackupCode(code);
    if (backupCodeHashes.includes(hash)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { mfaBackupCodeHashes: backupCodeHashes.filter((h) => h !== hash) },
      });
      return;
    }

    throw new UnauthorizedException("Invalid or expired code");
  }

  private async signMfaChallengeToken(userId: string): Promise<string> {
    const payload: MfaChallengePayload = { sub: userId, mfaPending: true };
    return this.jwt.signAsync(payload, { expiresIn: MFA_CHALLENGE_EXPIRES_IN });
  }

  async refresh(rawToken: string) {
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!record) throw new UnauthorizedException("Invalid or expired refresh token");

    if (record.revokedAt) {
      // Reuse of an already-rotated token is the classic signal that it was stolen (the thief and
      // the legitimate user are now racing on the same token). Revoke every other active refresh
      // token for this user so both are forced to re-authenticate, rather than failing silently.
      await this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Rotate: the presented token is single-use, preventing silent replay if it leaked.
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
    if (!user.isActive) throw new UnauthorizedException("Account disabled");

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
    };
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true, store: true } } },
    });

    const hasGlobalRole = user.roles.some((r) => r.storeId === null);
    const scopedStoreIds = user.roles.filter((r) => r.storeId).map((r) => r.storeId as string);
    const stores = hasGlobalRole
      ? await this.prisma.store.findMany({ where: { companyId: user.companyId ?? undefined } })
      : await this.prisma.store.findMany({ where: { id: { in: scopedStoreIds } } });

    return {
      user: this.toPublicUser(user),
      roles: user.roles.map((r) => ({ name: r.role.name, storeId: r.storeId, storeName: r.store?.name ?? null })),
      stores: stores.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    };
  }

  async updatePreferences(userId: string, prefs: { locale?: string; themePreference?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { locale: prefs.locale, themePreference: prefs.themePreference },
    });
    return this.toPublicUser(user);
  }

  private async signAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, companyId: user.companyId, email: user.email });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(raw), expiresAt } });
    return raw;
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: user.companyId,
      locale: user.locale,
      themePreference: user.themePreference,
      mfaEnabled: user.mfaEnabled,
      mfaRequired: user.mfaRequired,
    };
  }
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function parseDays(value: string | undefined, fallbackDays: number): number {
  const match = value?.match(/^(\d+)d$/);
  return match ? Number(match[1]) : fallbackDays;
}
