export interface AuthContext {
  userId: string;
  companyId: string;
  /**
   * The store the client is currently operating in (`x-store-id` header).
   * JwtAuthGuard reads it but doesn't require it; PermissionsGuard rejects
   * the request before a controller runs if a route needs it and it's
   * missing, so by the time a `@RequirePermissions(...)` handler executes
   * this is guaranteed to be set.
   */
  storeId: string;
}
