import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Request } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory sliding-window rate limiter for the unauthenticated,
 * brute-forceable endpoints (`/auth/login`, `/auth/mfa/verify`) — this repo
 * has no rate-limiting dependency installed and this environment has no
 * network access to add one, so this hand-rolled guard is the pragmatic
 * equivalent of @nestjs/throttler for a single API instance. A multi-instance
 * deployment should move the bucket store to Redis, same scale-out note as
 * `PosGateway`'s in-process room state.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxAttempts = 10;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = this.buildKey(req);
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.cleanupOccasionally(now);
      return true;
    }

    if (bucket.count >= this.maxAttempts) {
      throw new HttpException("Too many attempts — try again later", HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.count += 1;
    return true;
  }

  /** Keyed by route + caller IP + the identifier being attacked (email or MFA challenge token), so one bad actor can't lock out everyone else on the same IP (shared NAT/office network). */
  private buildKey(req: Request): string {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const body = (req.body ?? {}) as Record<string, unknown>;
    const identifier = (body.email as string | undefined) ?? (body.mfaToken as string | undefined) ?? "";
    return `${req.path}:${ip}:${identifier}`;
  }

  private cleanupOccasionally(now: number) {
    if (Math.random() > 0.02) return; // amortized sweep, keeps the map from growing unbounded
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt < now) this.buckets.delete(key);
    }
  }
}
