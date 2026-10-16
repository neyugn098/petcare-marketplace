import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceKm, locateDevice, locationErrorMessage, validCoordinates } from "../app/location";
import { safeReturnTo } from "../lib/supabase";
import { resolveActor } from "../db/runtime";
import { GET, POST } from "../app/auth/[action]/route";

test("location: permission denial is not retried; timeouts retry with GPS", async () => {
  let calls = 0;
  const denied = { getCurrentPosition(_ok: PositionCallback, fail?: PositionErrorCallback | null) { calls++; fail?.({ code: 1 } as GeolocationPositionError); } };
  await assert.rejects(locateDevice(denied));
  assert.equal(calls, 1);
  const options: PositionOptions[] = [];
  const retry = { getCurrentPosition(ok: PositionCallback, fail?: PositionErrorCallback | null, option?: PositionOptions) {
    options.push(option!);
    if (options.length === 1) fail?.({ code: 3 } as GeolocationPositionError);
    else ok({ coords: { latitude: 10.7, longitude: 106.7, accuracy: 20 } } as GeolocationPosition);
  } };
  assert.equal((await locateDevice(retry)).coords.latitude, 10.7);
  assert.deepEqual(options.map(o => o.enableHighAccuracy), [false, true]);
  assert.match(locationErrorMessage(1), /bị chặn/);
});

test("location: distances and coordinates handle equator and antipodes", () => {
  assert.ok(validCoordinates(0, 0));
  assert.ok(!validCoordinates(NaN, 1));
  assert.ok(!validCoordinates(91, 1));
  assert.equal(distanceKm([0, 0], [0, 0]), 0);
  assert.ok(Math.abs(distanceKm([0, 0], [0, 1]) - 111.195) < 0.01);
  assert.ok(Number.isFinite(distanceKm([0, 0], [0, 180])));
});

test("auth: only local destinations, fail closed and protect logout", async () => {
  const previous = { ...process.env };
  try {
    process.env.AUTH_MODE = "supabase";
    process.env.APP_URL = "https://petcare.example";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    for (const target of ["https://evil.example", "//evil.example", "/\\evil.example", "/auth/signout", "javascript:alert(1)"]) assert.equal(safeReturnTo(target), "/");
    assert.equal(safeReturnTo("/partner"), "/partner");
    const request = new Request("https://petcare.example/auth/signin", { headers: { "oai-authenticated-user-email": "forged@example.com", cookie: "sb-fake-auth-token=forged" } });
    assert.equal(await resolveActor(request), null);
    const result = await GET(request, { params: Promise.resolve({ action: "signin" }) });
    assert.equal(result.headers.get("location"), "https://petcare.example/auth/error?reason=setup");
    const logout = await POST(new Request("https://petcare.example/auth/signout", { method: "POST", headers: { origin: "https://evil.example" } }), { params: Promise.resolve({ action: "signout" }) });
    assert.equal(logout.status, 403);
    const getLogout = await GET(new Request("https://petcare.example/auth/signout"), { params: Promise.resolve({ action: "signout" }) });
    assert.match(await getLogout.text(), /method="post"/);
  } finally { process.env = previous; }
});

test("auth: cookie identity is never trusted without Supabase verification", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    process.env.AUTH_MODE = "supabase";
    process.env.SUPABASE_URL = "https://auth-test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "public-test-key";
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "fake", exp: Math.floor(Date.now()/1000)+3600 })}.fake`;
    const session = { access_token: token, refresh_token: "fake-refresh", expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: "bearer", user: { id: "fake", email: "forged@example.com" } };
    const request = new Request("https://petcare.example/", { headers: { cookie: `sb-auth-test-auth-token=base64-${encode(session)}` } });
    let calls = 0;
    globalThis.fetch = async (input) => {
      assert.match(String(input), /\/auth\/v1\/user$/);
      calls++;
      return Response.json({ msg: "Invalid JWT", code: "bad_jwt" }, { status: 401 });
    };
    assert.equal(await resolveActor(request), null);
    assert.ok(calls > 0, "session must be checked with Supabase");
    globalThis.fetch = async () => Response.json({ id: "verified-user", email: "verified@example.com", email_confirmed_at: "2026-01-01", user_metadata: { full_name: "Verified User", role: "owner" } });
    assert.deepEqual(await resolveActor(request), { email: "verified@example.com", fullName: "Verified User", isDemo: false });
  } finally { process.env = previous; globalThis.fetch = originalFetch; }
});
