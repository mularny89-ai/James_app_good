import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import { db } from "@/lib/db";

// Single-user app: the token cache lives in CompanySettings row 1. Local dev
// uses .env vars directly; the Azure app registration covers mellanconsulting.com.au.

export const MSAL_SCOPES = ["Mail.Read", "Mail.Send", "offline_access", "User.Read"];

function clientId(): string {
  return process.env.MSAL_CLIENT_ID || "eedcf15a-9a4b-4325-a2f4-f7fb0dfe3275";
}

export function msalRedirectUri(reqBase?: string): string {
  const base =
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    reqBase ||
    "http://localhost:12000";
  return `${base.replace(/\/$/, "")}/api/email/callback`;
}

export function requestBase(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || url.host;
  return `${proto}://${host}`;
}

// Secret comes from the env var if set, otherwise the value saved on the Email page.
async function getClientSecret(): Promise<string | undefined> {
  if (process.env.MSAL_CLIENT_SECRET) return process.env.MSAL_CLIENT_SECRET;
  const s = await db.companySettings.findUnique({ where: { id: 1 }, select: { msalClientSecret: true } });
  return s?.msalClientSecret || undefined;
}

export async function msalConfigured(): Promise<boolean> {
  return Boolean(await getClientSecret());
}

async function buildClient(): Promise<ConfidentialClientApplication> {
  const s = await db.companySettings.findUnique({ where: { id: 1 } });
  const secret = s?.msalClientSecret || process.env.MSAL_CLIENT_SECRET;
  const cachePlugin = {
    beforeCacheAccess: async (ctx: any) => {
      if (s?.msalTokenCache) ctx.tokenCache.deserialize(s.msalTokenCache);
    },
    afterCacheAccess: async (ctx: any) => {
      if (ctx.cacheHasChanged) {
        await db.companySettings.update({
          where: { id: 1 },
          data: { msalTokenCache: ctx.tokenCache.serialize() },
        });
      }
    },
  };
  const config: Configuration = {
    auth: {
      clientId: clientId(),
      clientSecret: secret,
      authority: `https://login.microsoftonline.com/${s?.msalTenantId || "common"}`,
    },
    cache: { cachePlugin },
  };
  return new ConfidentialClientApplication(config);
}

export async function msalConnection() {
  const s = await db.companySettings.findUnique({
    where: { id: 1 },
    select: { msalTokenCache: true, msalAccount: true },
  });
  return { connected: Boolean(s?.msalTokenCache), account: s?.msalAccount ?? "" };
}

export async function getAuthUrl(reqBase?: string): Promise<string> {
  const app = await buildClient();
  return app.getAuthCodeUrl({
    scopes: MSAL_SCOPES,
    redirectUri: msalRedirectUri(reqBase),
    prompt: "select_account",
  });
}

export async function handleAuthCallback(code: string, reqBase?: string): Promise<string> {
  const app = await buildClient();
  const result = await app.acquireTokenByCode({
    code,
    scopes: MSAL_SCOPES,
    redirectUri: msalRedirectUri(reqBase),
  });
  if (!result?.account) throw new Error("Microsoft did not return an account.");
  const homeId = result.account.homeAccountId;
  // Tenant the account lives in — subsequent token refreshes should hit it directly.
  const claims = result.idTokenClaims as Record<string, unknown> | undefined;
  const tenantId = result.account.tenantId || (claims?.tid as string) || "common";
  await db.companySettings.update({
    where: { id: 1 },
    data: { msalAccount: result.account.username || homeId, msalTenantId: tenantId },
  });
  return result.account.username || homeId;
}

async function acquireToken(): Promise<string> {
  if (!(await getClientSecret())) throw new Error("NOT_CONNECTED");
  const app = await buildClient();
  const accounts = await app.getTokenCache().getAllAccounts();
  if (!accounts.length) throw new Error("NOT_CONNECTED");
  try {
    const result = await app.acquireTokenSilent({ account: accounts[0], scopes: MSAL_SCOPES });
    if (!result?.accessToken) throw new Error("NOT_CONNECTED");
    return result.accessToken;
  } catch {
    throw new Error("NOT_CONNECTED");
  }
}

export async function graphRequest(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const token = await acquireToken();
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function disconnectMsal(): Promise<void> {
  await db.companySettings.update({
    where: { id: 1 },
    data: { msalTokenCache: "", msalAccount: "", msalTenantId: "common" },
  });
}
