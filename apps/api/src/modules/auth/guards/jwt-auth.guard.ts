import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthContext } from "../../../common/auth-context";
import { AccessTokenPayload } from "../auth.types";

/**
 * Global guard (see AuthModule): verifies the JWT on every request unless
 * the handler is marked @Public(). Populates `req.auth` with the identity
 * PermissionsGuard and controllers rely on; the active store comes from the
 * `x-store-id` header, not the token, so switching stores never requires a
 * new login.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const token = this.extractBearerToken(req);
    if (!token) throw new UnauthorizedException("Missing bearer token");

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const companyId = payload.companyId;
    if (!companyId) {
      throw new UnauthorizedException("Token has no associated company");
    }

    req.auth = {
      userId: payload.sub,
      companyId,
      storeId: req.header("x-store-id") ?? "",
    };
    return true;
  }

  private extractBearerToken(req: Request): string | null {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length).trim() || null;
  }
}
