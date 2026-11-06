import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup({ signedIn = true, admin = true, key = "server-secret-for-test", authError = null, total = 23 } = {}) {
  let reads = 0;
  const session = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "admin-id" } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: admin ? { user_id: "admin-id" } : null }) }) }) }),
  };
  const source = ts.transpileModule(readFileSync(new URL("../src/app/admin/customer-actions.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const mocks = {
    "@/lib/supabase/server": { createClient: async () => session },
    "@supabase/supabase-js": { createClient: (url, secret, options) => {
      assert.equal(secret, key);
      assert.equal(options.auth.persistSession, false);
      return { auth: { admin: { listUsers: async params => {
        reads++; assert.equal(params.perPage, 1);
        return { error: authError, data: { total, users: [{ email: "private@example.com" }] } };
      } } } };
    } },
  };
  vm.runInNewContext(source, { exports, require: name => mocks[name], process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: key } } });
  return { getCount: exports.getRegisteredCustomerCount, reads: () => reads };
}

test("only admins can access the Supabase Auth count", async () => {
  for (const options of [{ signedIn: false }, { admin: false }]) {
    const action = setup(options);
    assert.ok((await action.getCount()).error);
    assert.equal(action.reads(), 0);
  }
});

test("the full Auth account count is returned without account records or private keys", async () => {
  const result = await setup({ total: 2300 }).getCount();
  assert.equal(result.count, 2300);
  assert.deepEqual(Object.keys(result), ["count"]);
  assert.equal(JSON.stringify(result).includes("private@example.com"), false);
});

test("missing credentials do not display a fabricated count", async () => {
  const action = setup({ key: "" });
  const result = await action.getCount();
  assert.equal(result.count, undefined);
  assert.match(result.error, /SUPABASE_SECRET_KEY/);
  assert.equal(action.reads(), 0);
});

test("Supabase failures do not return a fabricated count", async () => {
  const result = await setup({ authError: new Error("Forbidden") }).getCount();
  assert.ok(result.error);
  assert.equal(result.count, undefined);
});
