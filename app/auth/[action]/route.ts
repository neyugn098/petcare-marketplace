import { NextResponse } from "next/server";
import { appOrigin, authClient, authConfigured, requestCookies, safeReturnTo } from "../../../lib/supabase";
import type { CookieOptions } from "@supabase/ssr";

type Context = { params: Promise<{ action: string }> };
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (!["signin", "signout", "callback"].includes(action)) return new Response("Not found", { status: 404 });
  const current = new URL(request.url);
  const origin = appOrigin(request);
  const returnTo = safeReturnTo(current.searchParams.get("return_to"));
  if (action === "signout") {
    return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><title>Đăng xuất PetCare</title><body><h1>Đăng xuất PetCare?</h1><form method="post" action="/auth/signout"><button>Đăng xuất</button></form><a href="/">Quay lại</a></body></html>', { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" } });
  }
  if (process.env.AUTH_MODE === "demo" && process.env.NODE_ENV !== "production") return NextResponse.redirect(new URL(returnTo, origin));
  if (process.env.AUTH_MODE === "proxy" && process.env.AUTH_SIGN_IN_URL && action === "signin") {
    const target = new URL(process.env.AUTH_SIGN_IN_URL);
    if (target.protocol === "https:") return NextResponse.redirect(target);
  }
  const failure = (reason: string) => NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, origin), { headers: noStore });
  if (!authConfigured()) return failure("setup");
  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  const client = authClient({ getAll: () => requestCookies(request), setAll: (cookies) => { pending.push(...cookies); } });
  const finish = (url: URL | string) => {
    const response = NextResponse.redirect(url, { headers: noStore });
    pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  };
  if (action === "callback") {
    const code = current.searchParams.get("code");
    if (!code || current.searchParams.has("error")) return failure("callback");
    const { error } = await client.auth.exchangeCodeForSession(code);
    return finish(new URL(error ? "/auth/error?reason=callback" : returnTo, origin));
  }
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("return_to", returnTo);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  return error || !data.url ? failure("setup") : finish(data.url);
}

export async function POST(request: Request, context: Context) {
  if ((await context.params).action !== "signout") return new Response("Not found", { status: 404 });
  const origin = appOrigin(request);
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  const response = NextResponse.redirect(new URL("/", origin), { status: 303, headers: noStore });
  if (authConfigured()) {
    const client = authClient({
      getAll: () => requestCookies(request),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    });
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return NextResponse.redirect(new URL("/auth/error?reason=signout", origin), { status: 303, headers: noStore });
  } else if (process.env.AUTH_MODE === "proxy" && process.env.AUTH_SIGN_OUT_URL) {
    const target = new URL(process.env.AUTH_SIGN_OUT_URL);
    if (target.protocol === "https:") return NextResponse.redirect(target, { status: 303, headers: noStore });
  }
  return response;
}
