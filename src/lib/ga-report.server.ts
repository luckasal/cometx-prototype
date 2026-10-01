import { createSign } from "node:crypto";

type ReportRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type Report = { rows?: ReportRow[]; totals?: ReportRow[] };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_URL = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
let cachedToken: { value: string; expiresAt: number } | null = null;

function encoded(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function accessToken(email: string, privateKey: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encoded({ alg: "RS256", typ: "JWT" })}.${encoded({
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok)
    throw new Error(
      "Google Analytics authorization failed. Check the service account access and credentials.",
    );
  const token = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw new Error("Google Analytics did not return an access token.");
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.min(token.expires_in ?? 3600, 3600) * 1000,
  };
  return token.access_token;
}

function count(row: ReportRow | undefined, index = 0): number {
  const value = Number(row?.metricValues?.[index]?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function readGaReport() {
  const propertyId = process.env["GA4_PROPERTY_ID"];
  const email = process.env["GA4_CLIENT_EMAIL"];
  const key = process.env["GA4_PRIVATE_KEY"]?.replace(/\\n/g, "\n");
  if (!propertyId || !email || !key) return { configured: false as const };
  if (!/^\d+$/.test(propertyId)) throw new Error("GA4_PROPERTY_ID must be a numeric property ID.");

  const token = await accessToken(email, key);
  const range = [{ startDate: "30daysAgo", endDate: "yesterday" }];
  async function run(dimensions: string[], metrics: string[], limit = 25): Promise<Report> {
    const response = await fetch(`${API_URL}/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        dateRanges: range,
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        limit,
        metricAggregations: dimensions.length ? [] : ["TOTAL"],
        orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
      }),
    });
    if (!response.ok)
      throw new Error(
        `Google Analytics report request failed (${response.status}). Check property access and Data API enablement.`,
      );
    return response.json() as Promise<Report>;
  }

  const [summary, channels, pages, events] = await Promise.all([
    run([], ["activeUsers", "sessions", "screenPageViews"], 1),
    run(["sessionDefaultChannelGroup"], ["sessions"], 10),
    run(["pagePath"], ["screenPageViews"], 10),
    run(["eventName"], ["eventCount"], 100),
  ]);
  return {
    configured: true as const,
    period: "Previous 30 days, through yesterday",
    visitors: count(summary.totals?.[0] ?? summary.rows?.[0]),
    sessions: count(summary.totals?.[0] ?? summary.rows?.[0], 1),
    pageViews: count(summary.totals?.[0] ?? summary.rows?.[0], 2),
    channels: (channels.rows ?? []).map((row) => ({
      name: row.dimensionValues?.[0]?.value ?? "Unknown",
      count: count(row),
    })),
    pages: (pages.rows ?? []).map((row) => ({
      name: row.dimensionValues?.[0]?.value ?? "/",
      count: count(row),
    })),
    events: Object.fromEntries(
      (events.rows ?? []).map((row) => [row.dimensionValues?.[0]?.value ?? "", count(row)]),
    ),
  };
}
