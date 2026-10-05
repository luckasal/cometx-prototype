const ROUTE_ASSET_RELOAD_PARAM = "__asset_reload";

export function isAssetLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk .* failed|error loading dynamically imported module/i.test(
    message,
  );
}

/** Add a one-off cache key so the browser asks the deployment for fresh HTML. */
export function assetRecoveryUrl(currentUrl: string, timestamp = Date.now()): string {
  const url = new URL(currentUrl);
  url.searchParams.set(ROUTE_ASSET_RELOAD_PARAM, String(timestamp));
  return url.toString();
}
