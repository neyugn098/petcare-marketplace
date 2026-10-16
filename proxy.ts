import { NextResponse, type NextRequest } from "next/server";
import { authClient, authConfigured } from "./lib/supabase";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!authConfigured() || request.nextUrl.pathname.startsWith("/auth/")) return response;
  const client = authClient({
    getAll: () => request.cookies.getAll(),
    setAll(cookies, headers) {
      cookies.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
    },
  });
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/", "/partner/:path*", "/api/app"] };
