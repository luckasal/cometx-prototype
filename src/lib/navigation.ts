export function safeReturnPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/account";
  try {
    const url = new URL(value, "https://cometx.invalid");
    return url.origin === "https://cometx.invalid" ? url.pathname + url.search + url.hash : "/account";
  } catch {
    return "/account";
  }
}
