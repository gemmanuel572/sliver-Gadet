"use server";

import { createClient } from "@/lib/supabase/server";
import { countRegisteredAuthUsers, CustomerCountError } from "@/lib/supabase/admin";
import { readCustomerAccount, readCustomerDirectory } from "@/lib/supabase/customer-directory";
import type { CustomerHistoryItem, DirectoryResult, CustomerDetailResult } from "@/lib/customer-directory";
import { databaseSetupError } from "@/lib/database-errors";

async function adminSession() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new CustomerCountError("UNAUTHENTICATED", "Please sign in to view registered customers.");
  const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) throw new CustomerCountError("FORBIDDEN", "Administrator access is required.");
  return supabase;
}

function safeError(error: unknown) {
  return error instanceof CustomerCountError ? { error: error.message, code: error.code }
    : { error: "Customer information is temporarily unavailable. Please refresh and try again.", code: "UNAVAILABLE" };
}

export async function getRegisteredCustomerCount() {
  try {
    await adminSession();
    return { count: await countRegisteredAuthUsers() };
  } catch (error) {
    // Only controlled messages can reach the browser. Never log credentials or SDK errors.
    if (error instanceof CustomerCountError) return { error: error.message, code: error.code };
    return { error: "Could not refresh the customer count. Please try again.", code: "UNAVAILABLE" };
  }
}

export async function getCustomerDirectory(page = 1, query = ""): Promise<DirectoryResult> {
  try {
    await adminSession();
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || typeof query !== "string" || query.length > 200) return { error: "Enter a valid customer search and page number.", code: "INVALID_REQUEST" };
    return { directory: await readCustomerDirectory(page, query.trim()) };
  } catch (error) { return safeError(error); }
}

export async function getCustomerDetails(id: string, page = 1): Promise<CustomerDetailResult> {
  try {
    const supabase = await adminSession();
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !Number.isSafeInteger(page) || page < 1 || page > 100000) return { error: "Invalid customer or order-history page.", code: "INVALID_REQUEST" };
    const customer = await readCustomerAccount(id);
    const { data, error } = await supabase.from("customer_orders").select("id,phone_name,kind,status,details,created_at")
      .eq("customer_id", id).order("created_at", { ascending: false }).range((page - 1) * 20, page * 20);
    if (error) return { customer, historyError: databaseSetupError("Customer history", "customer_orders", error) };
    const orders: CustomerHistoryItem[] = (data || []).slice(0, 20).map(order => ({ id: order.id, phone: order.phone_name,
      kind: order.kind, status: order.status, quantity: Number.isSafeInteger(order.details?.quantity) ? order.details.quantity : null, createdAt: order.created_at }));
    return { customer, history: { orders, page, hasMore: (data || []).length > 20 } };
  } catch (error) { return safeError(error); }
}
