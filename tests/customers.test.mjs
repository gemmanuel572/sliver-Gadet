import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient as realSupabaseClient } from "@supabase/supabase-js";

function compile(path, mocks, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
    return mocks[name];
  }, Buffer, URL, AbortSignal, ...globals });
  return exports;
}

function setup({ signedIn = true, admin = true, adminError = null,
  key = "sb_secret_test-key", legacyKey = "", total = 23, responses,
  authError = null, url = "https://test.supabase.co", publicKey = "sb_publishable_test-key" } = {}) {
  const calls = { clients: 0, pages: [], fetches: [] };
  let options;
  const session = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "admin-id" } : null } }) },
    from: table => {
      assert.equal(table, "admin_users");
      return { select: () => ({ eq: (column, id) => {
        assert.equal(column, "user_id"); assert.equal(id, "admin-id");
        return { maybeSingle: async () => ({ data: admin ? { user_id: id } : null, error: adminError }) };
      } }) };
    },
  };
  const helper = compile("../src/lib/supabase/admin.ts", {
    "server-only": {},
    "@supabase/supabase-js": { createClient: (projectUrl, secret, settings) => {
      calls.clients++; options = settings;
      assert.equal(projectUrl, url); assert.equal(secret, key.trim() || legacyKey);
      assert.equal(settings.auth.persistSession, false);
      assert.equal(settings.auth.autoRefreshToken, false);
      assert.equal(settings.auth.detectSessionInUrl, false);
      assert.equal(settings.auth.debug, false);
      return { auth: { admin: { listUsers: async params => {
        calls.pages.push(params);
        return responses ? responses[calls.pages.length - 1] : { error: authError, data: { total, users: total === 0 ? [] : [{ email: "private@example.com" }] } };
      } } } };
    } },
  }, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, SUPABASE_SERVICE_ROLE_KEY: legacyKey, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey } },
    fetch: async (input, init) => { calls.fetches.push(init); return { ok: true }; },
  });
  const action = compile("../src/app/admin/customer-actions.ts", {
    "@/lib/supabase/server": { createClient: async () => session },
    "@/lib/supabase/admin": helper,
    "@/lib/supabase/customer-directory": {},
    "@/lib/database-errors": {},
  });
  return { getCount: action.getRegisteredCustomerCount, calls, options: () => options };
}

const jwt = payload => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

test("unauthenticated users, non-admins and failed role checks never access the private client", async () => {
  for (const config of [{ signedIn: false }, { admin: false }, { adminError: new Error("Permission error") }]) {
    const action = setup(config);
    assert.ok((await action.getCount()).error);
    assert.equal(action.calls.clients, 0);
  }
});

test("only a real numeric total reaches the browser, without users or credentials", async () => {
  const action = setup({ total: 2300 });
  const result = await action.getCount();
  assert.equal(result.count, 2300);
  assert.deepEqual(Object.keys(result), ["count"]);
  assert.equal(JSON.stringify(result).includes("private@example.com"), false);
  assert.equal(JSON.stringify(result).includes("sb_secret_"), false);
  assert.equal(action.calls.pages[0].perPage, 1);
});

test("a verified empty Auth directory returns a genuine zero", async () => {
  assert.equal((await setup({ total: 0 }).getCount()).count, 0);
});

test("missing, public and malformed keys are rejected before any private API call", async () => {
  for (const [key, code] of [["", "KEY_MISSING"], ["sb_publishable_test-key", "PUBLIC_KEY"], ["Bearer sb_secret_test-key", "KEY_INVALID"], [jwt({ role: "anon" }), "KEY_ROLE"]]) {
    const action = setup({ key });
    const result = await action.getCount();
    assert.equal(result.code, code);
    assert.equal(result.count, undefined);
    assert.equal(action.calls.clients, 0);
    assert.equal(result.error.includes(key), key === "");
  }
});

test("legacy service role keys work, but keys belonging to another project are rejected", async () => {
  const supported = setup({ key: "", legacyKey: jwt({ role: "service_role", ref: "test" }) });
  assert.equal((await supported.getCount()).count, 23);
  const mismatch = setup({ key: jwt({ role: "service_role", ref: "another-project" }) });
  assert.equal((await mismatch.getCount()).code, "PROJECT_MISMATCH");
  assert.equal(mismatch.calls.clients, 0);
});

test("surrounding whitespace is trimmed and requests bypass caches with a timeout", async () => {
  const action = setup({ key: "  sb_secret_test-key  " });
  assert.equal((await action.getCount()).count, 23);
  await action.options().global.fetch("https://test.supabase.co/auth/v1/admin/users", {});
  assert.equal(action.calls.fetches[0].cache, "no-store");
  assert.ok(action.calls.fetches[0].signal);
});

test("missing pagination totals are recovered by counting every actual user page", async () => {
  const users = Array.from({ length: 1000 }, () => ({ id: "private-user" }));
  const action = setup({ responses: [
    { data: { total: 0, users: [{}] } },
    { data: { total: 0, users } },
    { data: { total: 0, users: [{}, {}] } },
  ] });
  assert.equal((await action.getCount()).count, 1002);
  assert.deepEqual(action.calls.pages.map(page => [page.page, page.perPage]), [[1, 1], [1, 1000], [2, 1000]]);
});

test("failure on a later page returns no partial count", async () => {
  const action = setup({ responses: [
    { data: { total: 0, users: [{}] } },
    { data: { users: Array.from({ length: 1000 }, () => ({})) } },
    { data: { users: [] }, error: { status: 503, message: "Sensitive raw failure" } },
  ] });
  const result = await action.getCount();
  assert.equal(result.count, undefined);
  assert.equal(result.code, "AUTH_UNAVAILABLE");
  assert.equal(result.error.includes("Sensitive raw failure"), false);
});

test("rejected credentials give a safe configuration error rather than zero or raw SDK details", async () => {
  const result = await setup({ authError: { status: 403, message: "sb_secret_do-not-expose" } }).getCount();
  assert.equal(result.code, "KEY_REJECTED");
  assert.equal(result.count, undefined);
  assert.equal(result.error.includes("sb_secret_do-not-expose"), false);
});

test("the installed Supabase SDK counts correctly when the Auth response omits Link headers", async () => {
  const requests = [];
  const helper = compile("../src/lib/supabase/admin.ts", {
    "server-only": {}, "@supabase/supabase-js": { createClient: realSupabaseClient },
  }, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test-key" } },
    fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/auth/v1/admin/users");
      assert.equal(new Headers(init.headers).get("apikey"), "sb_secret_test-key");
      assert.equal(init.cache, "no-store");
      requests.push([url.searchParams.get("page"), url.searchParams.get("per_page")]);
      const users = url.searchParams.get("per_page") === "1" ? [{ id: "one" }] : [{ id: "one" }, { id: "two" }, { id: "three" }];
      return new Response(JSON.stringify({ users }), { headers: { "content-type": "application/json", "x-total-count": "3" } });
    },
  });
  assert.equal(await helper.countRegisteredAuthUsers(), 3);
  assert.deepEqual(requests, [["1", "1"], ["1", "1000"]]);
});
