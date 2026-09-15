import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PermissionsService } from "./permissions.service";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { AuthRateLimitGuard } from "./guards/auth-rate-limit.guard";

/**
 * Fails fast at boot rather than falling back to a hardcoded/well-known secret —
 * a hardcoded fallback would let anyone who reads this source forge access
 * tokens for any user/company on any deployment that forgets to set the env var.
 */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-me") {
    throw new Error(
      'JWT_SECRET is not set (or still the placeholder "change-me"). Generate a real secret — e.g. ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" — and set it in .env before starting the API.`,
    );
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.register({
      secret: requireJwtSecret(),
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? "1d", algorithm: "HS256" },
      verifyOptions: { algorithms: ["HS256"] },
    }),
  ],
  controllers: [AuthController, RolesController],
  providers: [
    AuthService,
    PermissionsService,
    RolesService,
    AuthRateLimitGuard,
    // Order matters: identity (JWT) must resolve before permission checks run.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PermissionsService, JwtModule],
})
export class AuthModule {}
