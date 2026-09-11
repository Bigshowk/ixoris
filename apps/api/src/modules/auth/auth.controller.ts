import { Body, Controller, Get, HttpCode, Inject, Patch, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
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
}
