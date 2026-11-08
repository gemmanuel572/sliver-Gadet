"use server";

import { createClient } from "@/lib/supabase/server";
import { products } from "@/data/products";
import { isReportVerified, reportForPhone, validConditionKey, UNVERIFIED, type PhoneConditions } from "@/lib/phone-conditions";
import { applyInventoryOverrides, parsePhoneDetails } from "@/lib/inventory";
import { databaseSetupError } from "@/lib/database-errors";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: admin, error: adminError } = await supabase.from("admin_users")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  return admin && !adminError ? supabase : null;
}

export async function getAdminConditionPhones() {
  const inventory = await getAdminPhones(true);
  if (inventory.error) return { error: inventory.error };
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  const { data, error } = await supabase.from("phone_condition_reports").select("product_id,conditions,field_labels,removed_fields");
  if (error) return { error: databaseSetupError("Phone Conditions", "phone_condition_reports", error) };
  const saved = new Map((data || []).map(report => [report.product_id, report]));
  return { phones: (inventory.phones || []).filter(phone => phone.published && !phone.booked && !phone.removed).map(phone => ({
    id: phone.id, name: phone.name, brand: phone.brand,
    ...reportForPhone(phone.brand, products.find(item => item.id === phone.id)?.conditions, saved.get(phone.id)),
  })) };
}

export async function savePhoneConditions(id: string, values: PhoneConditions, requireComplete: boolean) {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length > 40 ||
      Object.entries(values).some(([key, value]) => !validConditionKey(key) || typeof value !== "string" || value.length > 160)) {
    return { error: "Use valid inspection fields and results up to 160 characters each." };
  }
  const available = await getAdminConditionPhones();
  if (available.error) return { error: available.error };
  const phone = available.phones?.find(phone => phone.id === id);
  if (!phone) return { error: "This phone is no longer published in the store." };
  const conditions = { ...phone.conditions, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() || UNVERIFIED])) };
  if (requireComplete && !isReportVerified(conditions)) return { error: "Check every item before verifying this phone, or save your progress." };
  const { error } = await supabase.from("phone_condition_reports").upsert({ product_id: id, conditions }, { onConflict: "product_id" });
  if (error) return { error: databaseSetupError("Phone Conditions", "phone_condition_reports", error) };
  return { success: true };
}

export async function saveInspectionField(id: string, key: string, label: string, value: string, operation: "save" | "clear" | "remove") {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  if (typeof id !== "string" || typeof key !== "string" || !validConditionKey(key) || typeof label !== "string" || !label.trim() || label.trim().length > 80 ||
      typeof value !== "string" || value.length > 160 || !["save", "clear", "remove"].includes(operation)) return { error: "Use a field label of up to 80 characters and a result of up to 160 characters." };
  const available = await getAdminConditionPhones();
  if (available.error) return { error: available.error };
  const phone = available.phones?.find(phone => phone.id === id);
  if (!phone) return { error: "This phone is no longer published in the store. Reload the phone list." };
  if (key === "trueTone" && phone.brand.toLowerCase() !== "apple" && operation !== "remove") return { error: "True Tone is only applicable to Apple phones." };
  if (operation === "save" && !(key in phone.conditions) && Object.keys(phone.conditions).length >= 40) return { error: "A phone can have up to 40 active inspection fields." };
  const { error } = await supabase.rpc("manage_phone_inspection_field", {
    phone_id: id, field_key: key, field_label: label.trim(), field_value: value.trim() || UNVERIFIED, field_operation: operation,
  });
  if (error) return { error: "Could not save this inspection field. Run supabase/migrations/202611060007_dynamic_inspection_fields.sql after supabase/repair.sql, then reload. If the phone was booked or removed, it is no longer in this list." };
  return { success: true };
}

export async function getAdminPhones(publishedOnly = false) {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  if (typeof publishedOnly !== "boolean") return { error: "Invalid inventory filter." };
  const source = supabase.from("phone_uploads").select("id,name,brand,price,description,colors,storage,is_published");
  const [uploads, availability] = await Promise.all([
    (publishedOnly ? source.eq("is_published", true) : source).order("created_at", { ascending: false }),
    supabase.from("phone_availability").select("product_id,booked,is_removed,overrides"),
  ]);
  if (uploads.error) return { error: databaseSetupError("Inventory", "phone_uploads", uploads.error) };
  if (availability.error) return { error: databaseSetupError("Inventory", "phone_availability", availability.error) };
  const states = new Map((availability.data || []).map(row => [row.product_id, row]));
  const withState = <T extends { id: string; name: string; brand: string; price: number; description: string; colors: string[]; storage: string[]; published: boolean }>(phone: T) => {
    const state = states.get(phone.id);
    return { ...applyInventoryOverrides(phone, state?.overrides), booked: Boolean(state?.booked), removed: Boolean(state?.is_removed) };
  };
  return { phones: [
    ...(uploads.data || []).map(phone => withState({ id: phone.id as string, name: phone.name as string, brand: phone.brand as string, price: Number(phone.price), description: phone.description as string, colors: phone.colors as string[], storage: phone.storage as string[], published: Boolean(phone.is_published) })),
    ...products.map(phone => withState({ ...phone, published: true })),
  ] };
}

async function inventoryPhoneExists(supabase: NonNullable<Awaited<ReturnType<typeof adminClient>>>, id: string) {
  if (typeof id !== "string") return false;
  if (products.some(phone => phone.id === id)) return true;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
  const { data, error } = await supabase.from("phone_uploads").select("id").eq("id", id).maybeSingle();
  return Boolean(data && !error);
}

export async function editInventoryPhone(id: string, form: FormData) {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  const details = parsePhoneDetails(form);
  if (!details) return { error: "Enter a phone name, brand, positive price, colours and storage options. Check field lengths." };
  if (!await inventoryPhoneExists(supabase, id)) return { error: "Phone not found." };
  const { error } = await supabase.from("phone_availability").upsert({ product_id: id, overrides: details }, { onConflict: "product_id" });
  if (error) return { error: databaseSetupError("Edit phone", "phone_availability", error) };
  return { success: true };
}

export async function removeInventoryPhone(id: string, removed: boolean) {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  if (typeof removed !== "boolean" || !await inventoryPhoneExists(supabase, id)) return { error: "Phone not found." };
  const { error } = await supabase.from("phone_availability").upsert({ product_id: id, is_removed: removed }, { onConflict: "product_id" });
  if (error) return { error: databaseSetupError("Remove/restore phone", "phone_availability", error) };
  return { success: true };
}

export async function setPhoneBooked(id: string, booked: boolean) {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  if (typeof id !== "string" || typeof booked !== "boolean") return { error: "Invalid phone details." };
  if (!products.some(phone => phone.id === id)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: "Phone not found." };
    const { data, error } = await supabase.from("phone_uploads").select("id").eq("id", id).maybeSingle();
    if (error || !data) return { error: "Phone not found." };
  }
  const { error } = await supabase.from("phone_availability").upsert({ product_id: id, booked }, { onConflict: "product_id" });
  if (error) return { error: "Could not change availability. Check the database setup and try again." };
  return { success: true };
}

export async function uploadPhone(form: FormData) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Please sign in again." };

  const { data: admin } = await supabase.from("admin_users")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return { error: "Administrator access is required." };

  const name = String(form.get("phoneType") || "").trim();
  const requestOrderId = String(form.get("requestOrderId") || "").trim();
  if (requestOrderId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestOrderId)) return { error: "Invalid special request." };
  const brand = String(form.get("brand") || "").trim();
  const price = Number(form.get("price"));
  const description = String(form.get("description") || "").trim();
  const colors = String(form.get("colors") || "").split(",").map(value => value.trim()).filter(Boolean);
  const storage = String(form.get("storage") || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!brand || brand.length > 80 || !Number.isFinite(price) || price <= 0 || price > 1000000000) {
    return { error: "Enter a brand and a valid starting price in naira." };
  }
  if (!colors.length || !storage.length || colors.length > 30 || storage.length > 30 || [...colors, ...storage].some(value => value.length > 80) || description.length > 2000) {
    return { error: "Enter colours and storage options separated by commas. Keep each option under 80 characters and the description under 2,000 characters." };
  }
  const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (!name || name.length > 120) return { error: "Enter a phone type of up to 120 characters." };
  if (!files.length || files.length > 6) return { error: "Select between 1 and 6 photos." };
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (files.some(file => !extensions[file.type] || file.size > 4 * 1024 * 1024)) {
    return { error: "Use JPG, PNG or WebP photos, each no larger than 4 MB." };
  }
  if (files.reduce((total, file) => total + file.size, 0) > 4 * 1024 * 1024) {
    return { error: "The selected photos must total no more than 4 MB." };
  }

  const paths: string[] = [];
  for (const file of files) {
    const path = `${user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    const { error: uploadError } = await supabase.storage.from("phone-photos").upload(path, file, { contentType: file.type });
    if (uploadError) {
      if (paths.length) await supabase.storage.from("phone-photos").remove(paths);
      return { error: "Could not upload photos. Check that the phone upload database and storage have been set up, then try again." };
    }
    paths.push(path);
  }

  const phoneData = { name, brand, price, description, colors, storage, is_published: true, photo_paths: paths, uploaded_by: user.id };
  const { error: saveError } = requestOrderId
    ? await supabase.rpc("publish_requested_phone", { request_order_id: requestOrderId, phone_data: phoneData })
    : await supabase.from("phone_uploads").insert(phoneData);
  if (saveError) {
    await supabase.storage.from("phone-photos").remove(paths);
    return { error: "Could not save this phone. Check the phone_uploads table and its permissions, then try again." };
  }
  return { success: true };
}
