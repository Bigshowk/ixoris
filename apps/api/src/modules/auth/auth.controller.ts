import { Body, Controller, Get, HttpCode, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { ChangePasswordDto, DisableMfaDto, EnableMfaDto, VerifyMfaDto } from "./dto/mfa.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { AuthRateLimitGuard } from "./guards/auth-rate-limit.guard";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.auth.logout(dto.refreshToken);
  }

  /** Identity + accessible stores + roles, so the client can build a store switcher after login. */
  @Get("me")
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth.userId);
  }

  /** Persists locale/theme choice server-side (in addition to the client's own localStorage cache). */
  @Patch("preferences")
  updatePreferences(@Body() dto: UpdatePreferencesDto, @CurrentAuth() auth: AuthContext) {
    return this.auth.updatePreferences(auth.userId, dto);
  }

  @Patch("password")
  changePassword(@Body() dto: ChangePasswordDto, @CurrentAuth() auth: AuthContext) {
    return this.auth.changePassword(auth.userId, dto.currentPassword, dto.newPassword);
  }

  /** Second step of login when the account has MFA enabled — exchanges the challenge token from /auth/login for real tokens. */
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post("mfa/verify")
  verifyMfa(@Body() dto: VerifyMfaDto) {
    return this.auth.verifyMfaLogin(dto.mfaToken, dto.code);
  }

  /** Starts (or restarts) MFA enrollment for the signed-in user — returns a secret to scan, not yet active. */
  @Post("mfa/setup")
  setupMfa(@CurrentAuth() auth: AuthContext) {
    return this.auth.setupMfa(auth.userId);
  }

  /** Confirms enrollment with a code from the authenticator app — flips mfaEnabled and returns one-time backup codes. */
  @Post("mfa/enable")
  enableMfa(@Body() dto: EnableMfaDto, @CurrentAuth() auth: AuthContext) {
    return this.auth.enableMfa(auth.userId, dto.code);
  }

  @Post("mfa/disable")
  disableMfa(@Body() dto: DisableMfaDto, @CurrentAuth() auth: AuthContext) {
    return this.auth.disableMfa(auth.userId, dto.password, dto.code);
  }
}
