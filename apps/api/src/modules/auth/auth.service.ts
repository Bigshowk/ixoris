import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { User } from "@ixoris/database";

const REFRESH_TOKEN_DAYS = parseDays(process.env.REFRESH_TOKEN_EXPIRES_IN, 30);

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

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
      user: this.toPublicUser(user),
    };
  }

  async refresh(rawToken: string) {
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
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
