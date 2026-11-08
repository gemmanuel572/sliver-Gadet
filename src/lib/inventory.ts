import type { Product } from "@/data/products";

export type PhoneDetails = Pick<Product, "name" | "brand" | "price" | "description" | "colors" | "storage">;
export type InventoryPhone = PhoneDetails & { id: string; published: boolean; booked: boolean; removed: boolean };

export function parsePhoneDetails(form: FormData): PhoneDetails | null {
  const value = (key: string) => String(form.get(key) || "").trim();
  const details = { name: value("phoneType"), brand: value("brand"), price: Number(value("price")), description: value("description"),
    colors: value("colors").split(",").map(item => item.trim()).filter(Boolean), storage: value("storage").split(",").map(item => item.trim()).filter(Boolean) };
  if (!details.name || details.name.length > 120 || !details.brand || details.brand.length > 80 || !Number.isFinite(details.price) || details.price <= 0 || details.price > 1000000000 || details.description.length > 2000 ||
    [details.colors, details.storage].some(items => items.length < 1 || items.length > 30 || items.some(item => item.length > 80))) return null;
  return details;
}

export function applyInventoryOverrides<T extends PhoneDetails>(phone: T, overrides: unknown): T {
  if (!overrides || typeof overrides !== "object") return phone;
  const saved = overrides as Record<string, unknown>;
  const result = { ...phone };
  for (const [key, max] of [["name", 120], ["brand", 80], ["description", 2000]] as const) {
    if (typeof saved[key] === "string" && saved[key].length <= max && (key === "description" || saved[key].trim())) result[key] = saved[key];
  }
  if (typeof saved.price === "number" && Number.isFinite(saved.price) && saved.price > 0 && saved.price <= 1000000000) result.price = saved.price;
  for (const key of ["colors", "storage"] as const) {
    const items = saved[key];
    if (Array.isArray(items) && items.length > 0 && items.length <= 30 && items.every(item => typeof item === "string" && item.trim() && item.length <= 80)) result[key] = items;
  }
  return result;
}
