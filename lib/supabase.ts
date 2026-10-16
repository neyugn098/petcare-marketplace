import { createServerClient, parseCookieHeader, type CookieMethodsServer } from "@supabase/ssr";

export function authConfigured() {
  return process.env.AUTH_MODE === "supabase" && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export function authClient(cookies: CookieMethodsServer) {
  if (!authConfigured()) throw new Error("Supabase Auth is not configured");
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookies,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
  });
}

export function requestCookies(request: Request) {
  return parseCookieHeader(request.headers.get("cookie") || "").map(({ name, value }) => ({ name, value: value || "" }));
}

// Only the two application landing pages may be OAuth return destinations.
export function safeReturnTo(value: string | null) { return value === "/partner" ? "/partner" : "/"; }

export function appOrigin(request: Request) {
  return new URL(process.env.APP_URL || request.url).origin;
}

export async function verifiedAuthActor(request: Request) {
  if (!authConfigured()) return null;
  const client = authClient({ getAll: () => requestCookies(request), setAll: () => {} });
  // getUser validates the session with Supabase; never authorize from cookie claims alone.
  const { data, error } = await client.auth.getUser();
  const user = data.user;
  if (error || !user?.email || !user.email_confirmed_at) return null;
  const email = user.email.trim().toLowerCase();
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : email;
  return { email, fullName: name.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").trim().slice(0, 160) || email, isDemo: false };
}
