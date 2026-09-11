import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSIONS_KEY = "requirePermissions";

/**
 * Declares which permission codes (from @ixoris/rbac) a route needs.
 * Enforced by PermissionsGuard, which also requires the `x-store-id` header
 * to be present on any route carrying at least one required permission.
 */
export const RequirePermissions = (...codes: string[]) => SetMetadata(REQUIRE_PERMISSIONS_KEY, codes);
