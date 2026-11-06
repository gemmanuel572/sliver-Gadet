"use server";

import { createClient } from "@/lib/supabase/server";
import { products } from "@/data/products";
import type { CustomerOrder, OrderDetails } from "@/lib/orders";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orderColumns = "id,customer_id,customer_email,product_id,kind,phone_name,listed_price,details,status,created_at";

export async function placeOrder(form: FormData, productId: string | null, requestId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in before placing an order." };
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) || (productId !== null && typeof productId !== "string")) return { error: "Invalid order. Please reload the page." };
  const value = (name: string) => String(form.get(name) || "").trim();
  const details: OrderDetails = {
    color: value("color"), storage: value("storage"), condition: value("condition"), quantity: Number(value("quantity")),
    customerName: value("customerName"), phone: value("phone"), alternativeName: value("alternativeName"), alternativePhone: value("alternativePhone"),
    address: value("address"), location: value("location"), deliveryPreference: value("deliveryPreference"), note: value("note"),
  };
  const namePattern = /^[\p{L}\s'.-]+$/u;
  if (!details.customerName || details.customerName.length > 160 || !namePattern.test(details.customerName) ||
      (details.alternativeName && (details.alternativeName.length > 160 || !namePattern.test(details.alternativeName))) ||
      !/^0[0-9]{10}$/.test(details.phone) || (details.alternativePhone && !/^0[0-9]{10}$/.test(details.alternativePhone))) {
    return { error: "Enter a valid customer name and 11-digit Nigerian phone numbers." };
  }
  if (!Number.isSafeInteger(details.quantity) || details.quantity < 1 || details.quantity > 10000 ||
      [details.color, details.storage, details.condition, details.address, details.location, details.deliveryPreference].some(text => !text || text.length > 1000) || details.note.length > 2000 ||
      !["Brand New", "UK Used", "Nigerian Used", ...(productId === null ? ["Any available condition"] : [])].includes(details.condition) ||
      !["Home Delivery", "Store Pickup", "Discuss with SILVA"].includes(details.deliveryPreference)) {
    return { error: "Check your phone preferences, quantity and delivery details. Notes must be under 2,000 characters." };
  }

  // The same submission can safely be retried if its response was lost.
  const { data: existing, error: existingError } = await supabase.from("customer_orders").select("id")
    .eq("customer_id", user.id).eq("request_id", requestId).maybeSingle();
  if (existingError) return { error: "Orders are temporarily unavailable. Please contact SILVA on WhatsApp to arrange your order." };
  if (existing) return { orderId: existing.id as string };

  let phoneName = value("phoneModel");
  let price: number | null = null;
  if (productId !== null) {
    const { data: availability, error: stockError } = await supabase.from("phone_availability").select("booked").eq("product_id", productId).maybeSingle();
    if (stockError) return { error: "We could not verify availability. Please try again." };
    if (availability?.booked) return { error: "This phone has already been booked. Please choose another phone." };
    let phone: { name: string; price: number; colors: string[]; storage: string[] } | undefined = products.find(item => item.id === productId);
    if (!phone) {
      if (!uuidPattern.test(productId)) return { error: "Phone not found." };
      const { data, error } = await supabase.from("phone_uploads").select("name,price,colors,storage")
        .eq("id", productId).eq("is_published", true).maybeSingle();
      if (error || !data) return { error: "This phone is no longer available." };
      phone = { name: data.name, price: Number(data.price), colors: data.colors, storage: data.storage };
    }
    if (!phone.colors.includes(details.color) || !phone.storage.includes(details.storage)) return { error: "Choose one of this phone’s available colours and storage options." };
    phoneName = phone.name; price = phone.price;
  }
  if (!phoneName || phoneName.length > 120) return { error: "Enter a phone model of up to 120 characters." };
  const { data, error } = await supabase.from("customer_orders").insert({
    request_id: requestId, customer_id: user.id, customer_email: user.email || "", product_id: productId,
    kind: productId === null ? "request" : "product", phone_name: phoneName, listed_price: price, details, status: "pending",
  }).select("id").single();
  if (error?.code === "23505") {
    const { data: duplicate } = await supabase.from("customer_orders").select("id").eq("customer_id", user.id).eq("request_id", requestId).maybeSingle();
    if (duplicate) return { orderId: duplicate.id as string };
  }
  if (error || !data) return { error: "Your order could not be saved. Please try again before continuing to WhatsApp." };
  return { orderId: data.id as string };
}

export async function getOrders(admin = false) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, orders: [] as CustomerOrder[] };
  if (authError) return { error: "Could not verify your account. Please try again." };
  if (admin) {
    const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error || !data) return { error: "Administrator access is required." };
  }
  let query = supabase.from("customer_orders").select(orderColumns).order("created_at", { ascending: false });
  if (!admin) query = query.eq("customer_id", user.id);
  const { data, error } = await query;
  if (error) return admin
    ? { error: "Could not load orders. Check the order database setup and try again." }
    : { signedIn: true, unavailable: true };
  if (!data?.length) return { signedIn: true, orders: [] as CustomerOrder[] };
  const { data: publications, error: publicationError } = await supabase.from("request_publications").select("order_id,product_id");
  if (publicationError) return admin
    ? { error: "Could not load special request availability. Check the request_publications table and try again." }
    : { signedIn: true, unavailable: true };
  const available = new Map((publications || []).map(row => [row.order_id, row.product_id]));
  return { signedIn: true, orders: (data || []).map(order => ({ ...order, request_available: available.has(order.id), published_product_id: available.get(order.id) || null })) as CustomerOrder[] };
}

export async function markRequestAvailable(id: string) {
  if (typeof id !== "string" || !uuidPattern.test(id)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." };
  const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) return { error: "Administrator access is required." };
  const { data: order, error: orderError } = await supabase.from("customer_orders").select("kind,status").eq("id", id).maybeSingle();
  if (orderError || !order || order.kind !== "request" || !["pending", "processing"].includes(order.status)) return { error: "This request is no longer waiting for a phone." };
  const { error } = await supabase.from("request_publications").upsert({ order_id: id }, { onConflict: "order_id", ignoreDuplicates: true });
  if (error) return { error: "Could not mark this phone as available. Please try again." };
  return { success: true };
}

export async function advanceOrder(id: string, status: "processing" | "awaiting_confirmation") {
  if (typeof id !== "string" || !uuidPattern.test(id) || !["processing", "awaiting_confirmation"].includes(status)) return { error: "Invalid order action." };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." };
  const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) return { error: "Administrator access is required." };
  const { error } = await supabase.rpc("advance_customer_order", { order_id: id, next_status: status });
  if (error) return { error: "Could not update this order. It may have changed; refresh the list and try again." };
  return { success: true };
}

export async function verifyDelivery(id: string) {
  if (typeof id !== "string" || !uuidPattern.test(id)) return { error: "Invalid order." };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." };
  const { data, error } = await supabase.from("customer_orders").update({ status: "completed" })
    .eq("id", id).eq("customer_id", user.id).eq("status", "awaiting_confirmation").select("id").maybeSingle();
  if (error || !data) return { error: "This order cannot be verified yet. Refresh your orders and try again." };
  return { success: true };
}
