import assert from "node:assert/strict";
import { test } from "node:test";
import { usernameEmail } from "../lib/username";
import { GET, POST } from "../app/auth/[action]/route";

test("password login validates names, protects origin and creates verified session cookies", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    process.env.APP_URL = "https://petcare.example";
    process.env.AUTH_MODE = "supabase";
    process.env.SUPABASE_URL = "https://auth-test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";
    assert.equal(usernameEmail(" NguyenMinhAnh "), "nguyenminhanh@users.petcare.invalid");
    for (const name of ["ab", "a@b.com", "a/b", "a b", "admin\nfoo", "a".repeat(33)]) assert.equal(usernameEmail(name), null);
    const context = { params: Promise.resolve({ action: "password" }) };
    const request = (origin = "https://petcare.example", username = "nguyenminhanh") => new Request("https://petcare.example/auth/password", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username, password: "Test-password123!", return_to: "https://evil.example" }) });
    assert.equal((await POST(request("https://evil.example"), context)).status, 403);
    globalThis.fetch = async () => { throw new Error("Invalid names must not reach auth"); };
    assert.match((await POST(request(undefined, "a@b.com"), context)).headers.get("location")!, /error=credentials/);
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /\/auth\/v1\/token\?grant_type=password/);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.email, "nguyenminhanh@users.petcare.invalid");
      calls++;
      return Response.json({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user: { id: "test-id", email: body.email, email_confirmed_at: new Date().toISOString() } });
    };
    const result = await POST(request(), context);
    assert.equal(result.status, 303);
    assert.equal(result.headers.get("location"), "https://petcare.example/");
    assert.match(result.headers.get("set-cookie")!, /HttpOnly/i);
    assert.equal(calls, 1);
    globalThis.fetch = async () => Response.json({ msg: "Invalid login credentials", code: "invalid_credentials" }, { status: 400 });
    const rejected = await POST(request(), context);
    assert.match(rejected.headers.get("location")!, /error=credentials/);
    assert.equal(rejected.headers.get("set-cookie"), null);
    const signin = await GET(new Request("https://petcare.example/auth/signin?return_to=%2Fpartner"), { params: Promise.resolve({ action: "signin" }) });
    assert.equal(signin.headers.get("location"), "https://petcare.example/login?return_to=%2Fpartner");
  } finally { process.env = previous; globalThis.fetch = originalFetch; }
});
