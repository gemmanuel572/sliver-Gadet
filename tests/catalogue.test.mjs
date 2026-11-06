import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => name in mocks ? mocks[name] : name === "@/lib/phone-conditions" ? load("../src/lib/phone-conditions.ts", {}) : require(name), File, crypto, console });
  return exports;
}

function phoneForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ phoneType: "Test Phone", brand: "Apple", price: "100000", colors: "Black, Blue", storage: "128GB" })) form.set(key, value);
  form.set("photos", new File([new Uint8Array([255, 216, 255])], "phone.jpg", { type: "image/jpeg" }));
  return form;
}

function uploadClient({ admin = true, saveError = null } = {}) {
  const calls = { inserts: [], uploads: [], removed: [], rpc: [] };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "admin-id" } } }) },
    from: table => table === "admin_users" ? {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: admin ? { user_id: "admin-id" } : null }) }) }),
    } : { insert: async value => { calls.inserts.push(value); return { error: saveError }; } },
    storage: { from: () => ({
      upload: async path => { calls.uploads.push(path); return {}; },
      remove: async paths => { calls.removed.push(...paths); return {}; },
    }) },
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return { error: saveError }; },
  };
  const { uploadPhone } = load("../src/app/admin/actions.ts", { "@/lib/supabase/server": { createClient: async () => client }, "@/data/products": load("../src/data/products.ts", {}) });
  return { uploadPhone, calls };
}

test("non-admin cannot upload or publish a phone", async () => {
  const { uploadPhone, calls } = uploadClient({ admin: false });
  assert.match((await uploadPhone(phoneForm())).error, /Administrator/);
  assert.equal(calls.uploads.length, 0);
  assert.equal(calls.inserts.length, 0);
});

test("missing price prevents publication before uploading photos", async () => {
  const { uploadPhone, calls } = uploadClient();
  const form = phoneForm(); form.delete("price");
  assert.ok((await uploadPhone(form)).error);
  assert.equal(calls.uploads.length, 0);
});

test("successful upload publishes the store details and photo paths together", async () => {
  const { uploadPhone, calls } = uploadClient();
  assert.equal((await uploadPhone(phoneForm())).success, true);
  assert.equal(calls.inserts[0].is_published, true);
  assert.deepEqual(Array.from(calls.inserts[0].colors), ["Black", "Blue"]);
  assert.equal(calls.inserts[0].price, 100000);
  assert.deepEqual(Array.from(calls.inserts[0].photo_paths), calls.uploads);
});

test("failed publication cleans up uploaded photos", async () => {
  const { uploadPhone, calls } = uploadClient({ saveError: new Error("database unavailable") });
  assert.ok((await uploadPhone(phoneForm())).error);
  assert.deepEqual(calls.removed, calls.uploads);
});

test("requested-phone uploads are published and linked through one database transaction", async () => {
  const { uploadPhone, calls } = uploadClient();
  const form = phoneForm(); form.set("requestOrderId", "11111111-1111-4111-8111-111111111111");
  assert.equal((await uploadPhone(form)).success, true);
  assert.equal(calls.inserts.length, 0);
  assert.equal(calls.rpc[0].name, "publish_requested_phone");
  assert.equal(calls.rpc[0].args.request_order_id, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(Array.from(calls.rpc[0].args.phone_data.photo_paths), calls.uploads);
  const failed = uploadClient({ saveError: new Error("Request already published") });
  assert.ok((await failed.uploadPhone(form)).error);
  assert.deepEqual(failed.calls.removed, failed.calls.uploads);
});

test("public catalogue filters published phones, signs photos and retains existing phones", async () => {
  const filters = [];
  const { products } = load("../src/data/products.ts", {});
  const { GET } = load("../src/app/api/products/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, options }) } },
    "@/data/products": { products },
    "@/lib/supabase/server": { createClient: async () => ({
      from: table => table === "phone_condition_reports" ? { select: async () => ({ data: [
        { product_id: "new-phone", conditions: { batteryHealth: "94%", screen: "Cracked — disclosed" } },
        { product_id: products[0].id, conditions: { batteryHealth: "90%" } },
      ] }) } : ({ select: () => ({ eq: (key, value) => {
        if (table === "phone_availability") return Promise.resolve({ data: [] });
        filters.push([key, value]);
        return { order: async () => ({ data: [{ id: "new-phone", name: "New Phone", brand: "Apple", price: "100000.00", colors: ["Black"], storage: ["128GB"], photo_paths: ["photo.jpg"], created_at: "2026-11-06T00:00:00Z" }] }) };
      } }) }),
      storage: { from: () => ({ createSignedUrls: async () => ({ data: [{ signedUrl: "https://example.com/signed-photo" }] }) }) },
    }) },
  });
  const response = await GET();
  assert.deepEqual(filters, [["is_published", true]]);
  assert.equal(response.body.products.length, products.length + 1);
  assert.equal(response.body.products[0].image, "https://example.com/signed-photo");
  assert.equal(response.body.products[0].price, 100000);
  assert.equal(response.body.products[0].conditions.batteryHealth, "94%");
  assert.equal(response.body.products[0].conditions.screen, "Cracked — disclosed");
  assert.equal(response.body.products[0].conditions.cameras, "Not yet verified");
  assert.equal(response.body.products.find(phone => phone.id === products[0].id).conditions.batteryHealth, "90%");
  assert.equal(response.options.headers["Cache-Control"], "no-store");
});

test("booked original and uploaded phones are excluded even for an admin viewer", async () => {
  const { products } = load("../src/data/products.ts", {});
  let signingCalls = 0;
  const { GET } = load("../src/app/api/products/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, options }) } },
    "@/data/products": { products },
    "@/lib/supabase/server": { createClient: async () => ({
      from: table => table === "phone_condition_reports" ? { select: async () => ({ data: [] }) } : ({ select: () => ({ eq: () => table === "phone_availability"
        ? Promise.resolve({ data: [{ product_id: products[0].id }, { product_id: "booked-upload" }] })
        : { order: async () => ({ data: [{ id: "booked-upload" }] }) } }) }),
      storage: { from: () => ({ createSignedUrls: async () => { signingCalls++; throw new Error("Should not sign booked photos"); } }) },
    }) },
  });
  const response = await GET();
  assert.equal(response.body.products.length, products.length - 1);
  assert.equal(response.body.products.some(phone => phone.id === products[0].id || phone.id === "booked-upload"), false);
  assert.equal(signingCalls, 0);
});

test("condition verification requires admin access, all results and a successful database save", async () => {
  const productsModule = load("../src/data/products.ts", {});
  const helpers = load("../src/lib/phone-conditions.ts", {});
  let isAdmin = false;
  let saveError = null;
  const reports = [];
  const { savePhoneConditions } = load("../src/app/admin/actions.ts", {
    "@/data/products": productsModule,
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin-id" } } }) },
      from: table => table === "admin_users" ? {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: isAdmin ? { user_id: "admin-id" } : null }) }) }),
      } : { upsert: async value => { if (!saveError) reports.push(value); return { error: saveError }; } },
    }) },
  });
  const id = productsModule.products[0].id;
  const pending = helpers.defaultConditions("Apple");
  assert.ok((await savePhoneConditions(id, pending, false)).error);
  assert.equal(reports.length, 0);
  isAdmin = true;
  assert.ok((await savePhoneConditions(id, pending, true)).error);
  assert.equal(reports.length, 0);
  assert.equal((await savePhoneConditions(id, { ...pending, batteryHealth: "90%" }, false)).success, true);
  assert.equal(helpers.isReportVerified(reports[0].conditions), false);
  const completed = Object.fromEntries(helpers.conditionKeys.map(key => [key, key === "screen" ? "Cracked — disclosed" : "Working — tested"]));
  assert.equal((await savePhoneConditions(id, completed, true)).success, true);
  assert.equal(helpers.isReportVerified(reports[1].conditions), true);
  assert.equal(reports[1].conditions.screen, "Cracked — disclosed");
  assert.ok((await savePhoneConditions(id, { ...completed, screen: " " }, true)).error);
  saveError = new Error("Database unavailable");
  assert.ok((await savePhoneConditions(id, completed, true)).error);
  assert.equal(reports.length, 2);
});

test("missing database setup lists the homepage phones but clearly blocks verification", async () => {
  const productsModule = load("../src/data/products.ts", {});
  const missing = { code: "PGRST205", message: "Table not found" };
  const { getAdminConditionPhones } = load("../src/app/admin/actions.ts", {
    "@/data/products": productsModule,
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin-id" } } }) },
      from: table => {
        if (table === "admin_users") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "admin-id" } }) }) }) };
        if (table === "phone_uploads") return { select: () => ({ order: async () => ({ error: missing }) }) };
        return { select: async () => ({ error: missing }) };
      },
    }) },
  });
  const result = await getAdminConditionPhones();
  assert.equal(result.setupRequired, true);
  assert.match(result.error, /supabase\/setup.sql/);
  assert.equal(result.phones.length, productsModule.products.length);
  assert.equal(result.phones[0].conditions.batteryHealth, "Not yet verified");
});

test("an admin condition edit replaces unverified values in the public homepage catalogue", async () => {
  const productsModule = load("../src/data/products.ts", {});
  const helpers = load("../src/lib/phone-conditions.ts", {});
  const saved = new Map();
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "admin-id" } } }) },
    from: table => {
      if (table === "admin_users") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "admin-id" } }) }) }) };
      if (table === "phone_condition_reports") return {
        upsert: async row => { saved.set(row.product_id, row.conditions); return {}; },
        select: async () => ({ data: [...saved].map(([product_id, conditions]) => ({ product_id, conditions })) }),
      };
      if (table === "phone_availability") return { select: () => ({ eq: async () => ({ data: [] }) }) };
      return { select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) };
    },
  };
  const mocks = { "@/data/products": productsModule, "@/lib/supabase/server": { createClient: async () => client } };
  const { savePhoneConditions } = load("../src/app/admin/actions.ts", mocks);
  const { GET } = load("../src/app/api/products/route.ts", {
    ...mocks, "next/server": { NextResponse: { json: body => body } },
  });
  const phone = productsModule.products[0];
  const edit = { ...phone.conditions, batteryHealth: "91% — tested", screen: "Replaced — working" };
  assert.equal((await savePhoneConditions(phone.id, edit, false)).success, true);
  const partial = (await GET()).products.find(product => product.id === phone.id);
  assert.equal(partial.conditions.batteryHealth, edit.batteryHealth);
  assert.equal(partial.conditions.screen, edit.screen);
  assert.equal(partial.conditions.cameras, "Not yet verified");
  assert.equal(helpers.isReportVerified(partial.conditions), false);
  const completed = Object.fromEntries(helpers.conditionKeys.map(key => [key, key === "batteryHealth" ? "91% — tested" : "Working — tested"]));
  assert.equal((await savePhoneConditions(phone.id, completed, true)).success, true);
  const published = (await GET()).products.find(product => product.id === phone.id);
  assert.equal(helpers.isReportVerified(published.conditions), true);
  assert.equal(published.conditions.cameras, "Working — tested");
  assert.equal(phone.conditions.batteryHealth, "Not yet verified");
});

test("availability failure does not return a catalogue containing possibly booked phones", async () => {
  const { GET } = load("../src/app/api/products/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, options }) } },
    "@/data/products": load("../src/data/products.ts", {}),
    "@/lib/supabase/server": { createClient: async () => ({
      from: () => ({ select: () => ({ eq: async () => ({ error: new Error("Unavailable") }) }) }),
    }) },
  });
  const response = await GET();
  assert.equal(response.options.status, 503);
  assert.equal(response.body.products, undefined);
});

test("original featured phones stay visible before the new database tables are created", async () => {
  const { products } = load("../src/data/products.ts", {});
  const missing = { code: "PGRST205", message: "Table missing" };
  const { GET } = load("../src/app/api/products/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, options }) } },
    "@/data/products": { products },
    "@/lib/supabase/server": { createClient: async () => ({
      from: table => {
        if (table === "phone_condition_reports") return { select: async () => ({ error: missing }) };
        if (table === "phone_availability") return { select: () => ({ eq: async () => ({ error: missing }) }) };
        return { select: () => ({ eq: () => ({ order: async () => ({ error: missing }) }) }) };
      },
    }) },
  });
  const response = await GET();
  assert.equal(response.options.status, undefined);
  assert.deepEqual(Array.from(response.body.products, phone => phone.id), Array.from(products, phone => phone.id));
  assert.equal(response.body.products[0].conditions.batteryHealth, "Not yet verified");
});

test("missing upload and inspection tables do not restore phones already marked booked", async () => {
  const { products } = load("../src/data/products.ts", {});
  const missing = { code: "PGRST205", message: "Table missing" };
  const { GET } = load("../src/app/api/products/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, options }) } },
    "@/data/products": { products },
    "@/lib/supabase/server": { createClient: async () => ({
      from: table => {
        if (table === "phone_availability") return { select: () => ({ eq: async () => ({ data: [{ product_id: products[0].id }] }) }) };
        if (table === "phone_condition_reports") return { select: async () => ({ error: missing }) };
        return { select: () => ({ eq: () => ({ order: async () => ({ error: missing }) }) }) };
      },
    }) },
  });
  const response = await GET();
  assert.equal(response.body.products.length, products.length - 1);
  assert.equal(response.body.products.some(phone => phone.id === products[0].id), false);
});

test("only admins can change booking status, and cancelled bookings can be restored", async () => {
  const productsModule = load("../src/data/products.ts", {});
  const changes = [];
  let isAdmin = false;
  const { setPhoneBooked } = load("../src/app/admin/actions.ts", {
    "@/data/products": productsModule,
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin-id" } } }) },
      from: table => table === "admin_users" ? {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: isAdmin ? { user_id: "admin-id" } : null }) }) }),
      } : { upsert: async value => { changes.push(value); return {}; } },
    }) },
  });
  const id = productsModule.products[0].id;
  assert.ok((await setPhoneBooked(id, true)).error);
  assert.equal(changes.length, 0);
  isAdmin = true;
  assert.equal((await setPhoneBooked(id, true)).success, true);
  assert.equal(changes[0].booked, true);
  assert.equal((await setPhoneBooked(id, false)).success, true);
  assert.equal(changes[1].booked, false);
  assert.ok((await setPhoneBooked("unknown-phone", true)).error);
  assert.equal(changes.length, 2);
});
