import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { REQUIRE_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { AuthContext } from "../../../common/auth-context";
import { PermissionsService } from "../permissions.service";

/**
 * Runs after JwtAuthGuard. A route with no @RequirePermissions(...) passes
 * through untouched (e.g. GET /auth/me). A route that declares permissions
 * also requires the `x-store-id` header — POS/accounting/HR actions are
 * always taken in the context of one store, so a missing header is a client
 * bug worth rejecting explicitly rather than silently scoping to "no store".
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const auth = req.auth;
    if (!auth) throw new UnauthorizedException();
    if (!auth.storeId) throw new BadRequestException("Missing x-store-id header");

    const granted = await this.permissions.getEffectivePermissions(auth.userId, auth.storeId);
    const missing = required.filter((code) => !granted.has(code));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}
