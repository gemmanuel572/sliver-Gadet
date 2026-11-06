import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function compile(path, mocks = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
    return mocks[name];
  } });
  return exports;
}
const productsModule = compile("../src/data/products.ts");
const orderId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";

function setup({ admin = false, user = true, booked = false, existing = false, writeError = false, readError = false, orderStatus = "awaiting_confirmation", owner = customerId, kind = "request" } = {}) {
  const calls = { writes: [], filters: [], rpc: [] };
  const client = {
    auth: { getUser: async () => ({ data: { user: user ? { id: customerId, email: "customer@example.com" } : null } }) },
    from(table) {
      const filters = [];
      let operation = "select";
      let payload;
      const run = async (single = false) => {
        calls.filters.push({ table, filters: [...filters], operation });
        if (table === "admin_users") return { data: admin ? { user_id: customerId } : null };
        if (table === "phone_availability") return { data: { booked } };
        if (table === "customer_orders" && operation === "select" && readError) return { error: { code: "PGRST205", message: "Table missing" } };
        if (operation === "insert" || operation === "upsert") {
          if (writeError) return { error: { message: "Database unavailable" } };
          calls.writes.push({ table, payload });
          return { data: { id: orderId } };
        }
        if (operation === "update") {
          const matched = filters.every(([key, value]) => ({ id: orderId, customer_id: owner, status: orderStatus })[key] === value);
          if (writeError || !matched) return { data: null, error: writeError ? new Error("Database unavailable") : null };
          calls.writes.push({ table, payload });
          return { data: { id: orderId } };
        }
        if (table === "request_publications") return { data: [] };
        if (filters.some(([key]) => key === "request_id")) return { data: existing ? { id: orderId } : null };
        if (single) return { data: { id: orderId, kind, status: orderStatus } };
        return { data: [{ id: orderId, customer_id: customerId, kind, status: orderStatus }] };
      };
      const query = {
        select() { return query; }, order() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        insert(value) { operation = "insert"; payload = value; return query; },
        upsert(value) { operation = "upsert"; payload = value; return query; },
        update(value) { operation = "update"; payload = value; return query; },
        maybeSingle() { return run(true); }, single() { return run(true); },
        then(resolve, reject) { return run().then(resolve, reject); },
      };
      return query;
    },
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return writeError ? { error: new Error("RPC failed") } : { data: orderId }; },
  };
  const actions = compile("../src/app/orders/actions.ts", { "@/lib/supabase/server": { createClient: async () => client }, "@/data/products": productsModule });
  return { ...actions, calls };
}

function form() {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    phoneModel: "iPhone 17", color: productsModule.products[0].colors[0], storage: productsModule.products[0].storage[0],
    condition: "UK Used", quantity: "1", customerName: "Test Customer", phone: "08012345678", address: "1 Test Street", location: "Otukpo", deliveryPreference: "Home Delivery",
  })) result.set(key, value);
  return result;
}

test("orders require login and use the authenticated owner and catalogue price", async () => {
  const unauthenticated = setup({ user: false });
  assert.ok((await unauthenticated.placeOrder(form(), productsModule.products[0].id, requestId)).error);
  assert.equal(unauthenticated.calls.writes.length, 0);
  const { placeOrder, calls } = setup();
  const fields = form(); fields.set("price", "1"); fields.set("customer_id", "someone-else");
  assert.equal((await placeOrder(fields, productsModule.products[0].id, requestId)).orderId, orderId);
  assert.equal(calls.writes[0].payload.customer_id, customerId);
  assert.equal(calls.writes[0].payload.listed_price, productsModule.products[0].price);
  assert.equal(calls.writes[0].payload.status, "pending");
});

test("booked phones cannot receive new orders and retrying a saved submission does not duplicate it", async () => {
  const blocked = setup({ booked: true });
  assert.ok((await blocked.placeOrder(form(), productsModule.products[0].id, requestId)).error);
  assert.equal(blocked.calls.writes.length, 0);
  const retry = setup({ existing: true, booked: true });
  assert.equal((await retry.placeOrder(form(), productsModule.products[0].id, requestId)).orderId, orderId);
  assert.equal(retry.calls.writes.length, 0);
});

test("special requests are saved with their requested model and no invented price", async () => {
  const { placeOrder, calls } = setup();
  assert.equal((await placeOrder(form(), null, requestId)).orderId, orderId);
  assert.equal(calls.writes[0].payload.kind, "request");
  assert.equal(calls.writes[0].payload.phone_name, "iPhone 17");
  assert.equal(calls.writes[0].payload.product_id, null);
  assert.equal(calls.writes[0].payload.listed_price, null);
});

test("failed saves do not return an order reference", async () => {
  const { placeOrder } = setup({ writeError: true });
  const result = await placeOrder(form(), null, requestId);
  assert.ok(result.error); assert.equal(result.orderId, undefined);
});

test("customers can only verify their own orders awaiting delivery confirmation", async () => {
  const other = setup({ owner: "someone-else" });
  assert.ok((await other.verifyDelivery(orderId)).error);
  assert.equal(other.calls.writes.length, 0);
  const pending = setup({ orderStatus: "pending" });
  assert.ok((await pending.verifyDelivery(orderId)).error);
  const delivered = setup();
  assert.equal((await delivered.verifyDelivery(orderId)).success, true);
  assert.equal(delivered.calls.writes[0].payload.status, "completed");
});

test("customer order reads are scoped to the owner and admin mode cannot be requested by a customer", async () => {
  const customer = setup();
  assert.equal((await customer.getOrders()).signedIn, true);
  assert.ok(customer.calls.filters.some(query => query.table === "customer_orders" && query.filters.some(([key, value]) => key === "customer_id" && value === customerId)));
  assert.ok((await customer.getOrders(true)).error);
  const admin = setup({ admin: true });
  assert.equal((await admin.getOrders(true)).signedIn, true);
});

test("database failures expose setup instructions only in the authorized admin view", async () => {
  const customer = setup({ readError: true });
  const publicResult = await customer.getOrders();
  assert.equal(publicResult.unavailable, true);
  assert.equal(publicResult.signedIn, true);
  assert.equal(publicResult.error, undefined);
  assert.equal(publicResult.orders, undefined);
  const admin = setup({ admin: true, readError: true });
  assert.match((await admin.getOrders(true)).error, /database setup/);
  const failedSubmission = await customer.placeOrder(form(), null, requestId);
  assert.ok(failedSubmission.error);
  assert.doesNotMatch(failedSubmission.error, /database|setup|table/i);
  assert.match(failedSubmission.error, /WhatsApp/);
});

test("only admins can mark delivery and an admin cannot complete delivery on the customer's behalf through this action", async () => {
  const customer = setup();
  assert.ok((await customer.advanceOrder(orderId, "awaiting_confirmation")).error);
  assert.equal(customer.calls.rpc.length, 0);
  const admin = setup({ admin: true });
  assert.equal((await admin.advanceOrder(orderId, "awaiting_confirmation")).success, true);
  assert.equal(admin.calls.rpc[0].name, "advance_customer_order");
  assert.ok((await admin.advanceOrder(orderId, "completed")).error);
});

test("only waiting special requests can be marked available", async () => {
  const customer = setup({ orderStatus: "pending" });
  assert.ok((await customer.markRequestAvailable(orderId)).error);
  const completed = setup({ admin: true, orderStatus: "completed" });
  assert.ok((await completed.markRequestAvailable(orderId)).error);
  const regular = setup({ admin: true, orderStatus: "pending", kind: "product" });
  assert.ok((await regular.markRequestAvailable(orderId)).error);
  const waiting = setup({ admin: true, orderStatus: "processing" });
  assert.equal((await waiting.markRequestAvailable(orderId)).success, true);
  assert.equal(waiting.calls.writes[0].table, "request_publications");
});
