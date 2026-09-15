const DEFAULT_DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];

/**
 * Falls back to the three local dev origins instead of a wildcard "*" when
 * CORS_ORIGIN is unset, so a deployment that forgets to set the env var
 * doesn't silently open the API (HTTP and the /pos WebSocket namespace) to
 * every origin on the web. Set CORS_ORIGIN explicitly (comma-separated) for
 * any non-local deployment — see .env.example.
 */
export function corsOrigin(): string[] {
  return process.env.CORS_ORIGIN?.split(",") ?? DEFAULT_DEV_ORIGINS;
}
