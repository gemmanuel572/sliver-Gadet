"use server";

import { createClient } from "@/lib/supabase/server";
import { products } from "@/data/products";
import { conditionKeys, defaultConditions, isReportVerified, mergeConditions, type PhoneConditions } from "@/lib/phone-conditions";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: admin, error: adminError } = await supabase.from("admin_users")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  return admin && !adminError ? supabase : null;
}

export async function getAdminConditionPhones() {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  const [uploads, reports] = await Promise.all([
    supabase.from("phone_uploads").select("id,name,brand").order("created_at", { ascending: false }),
    supabase.from("phone_condition_reports").select("product_id,conditions"),
  ]);
  if (uploads.error || reports.error) {
    const missingTable = [uploads.error, reports.error].some(error => error && ["PGRST205", "42P01"].includes(error.code));
    if (missingTable) return {
      error: "The phone database has not been set up. Run supabase/setup.sql once in your Supabase SQL editor, then reload this list. Conditions cannot be saved until setup is complete.",
      setupRequired: true,
      phones: products.map(phone => ({ id: phone.id, name: phone.name, conditions: phone.conditions })),
    };
    return { error: "Could not load phone conditions. Please retry; saved reports could not be checked." };
  }
  const saved = new Map((reports.data || []).map(row => [row.product_id, row.conditions]));
  return { phones: [
    ...(uploads.data || []).map(phone => ({ id: phone.id as string, name: phone.name as string, conditions: mergeConditions(defaultConditions(phone.brand), saved.get(phone.id)) })),
    ...products.map(phone => ({ id: phone.id, name: phone.name, conditions: mergeConditions(phone.conditions, saved.get(phone.id)) })),
  ] };
}

export async function savePhoneConditions(id: string, values: PhoneConditions, requireComplete: boolean) {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  if (typeof id !== "string" || typeof requireComplete !== "boolean" || !values || typeof values !== "object" ||
      Object.keys(values).length !== conditionKeys.length || conditionKeys.some(key => typeof values[key] !== "string" || !values[key].trim() || values[key].trim().length > 160)) {
    return { error: "Enter a result for every inspection field, using up to 160 characters each. Leave untested fields as Not yet verified." };
  }
  if (!products.some(phone => phone.id === id)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: "Phone not found." };
    const { data, error } = await supabase.from("phone_uploads").select("id").eq("id", id).maybeSingle();
    if (error || !data) return { error: "Phone not found." };
  }
  const conditions = Object.fromEntries(conditionKeys.map(key => [key, values[key].trim()])) as PhoneConditions;
  if (requireComplete && !isReportVerified(conditions)) return { error: "Check every item before verifying this phone, or save your progress." };
  const { error } = await supabase.from("phone_condition_reports").upsert({ product_id: id, conditions }, { onConflict: "product_id" });
  if (error) return { error: ["PGRST205", "42P01"].includes(error.code)
    ? "The condition report table is missing. Run supabase/setup.sql in Supabase before saving inspections."
    : "Could not save this condition report. Your changes have not been published. Please try again." };
  return { success: true };
}

export async function getAdminPhones() {
  const supabase = await adminClient();
  if (!supabase) return { error: "Administrator access is required." };
  const [uploads, availability] = await Promise.all([
    supabase.from("phone_uploads").select("id,name,brand,price,is_published").order("created_at", { ascending: false }),
    supabase.from("phone_availability").select("product_id,booked"),
  ]);
  if (uploads.error || availability.error) return { error: "Could not load inventory. Check the database setup and try again." };
  const booked = new Set((availability.data || []).filter(row => row.booked).map(row => row.product_id));
  return { phones: [
    ...(uploads.data || []).map(phone => ({ id: phone.id as string, name: phone.name as string, price: Number(phone.price), published: Boolean(phone.is_published), booked: booked.has(phone.id) })),
    ...products.map(phone => ({ id: phone.id, name: phone.name, price: phone.price, published: true, booked: booked.has(phone.id) })),
  ] };
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
