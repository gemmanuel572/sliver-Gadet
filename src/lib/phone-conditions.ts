import type { Product } from "@/data/products";

export type PhoneConditions = Product["conditions"];
export const conditionLabels: Record<string, string> = {
  batteryHealth: "Battery Health", screen: "Screen Condition", faceIdOrFingerprint: "Face ID / Fingerprint",
  cameras: "Cameras", speakers: "Speakers", microphone: "Microphone", chargingPort: "Charging Port",
  network: "Network", wifi: "Wi-Fi", bluetooth: "Bluetooth", trueTone: "True Tone",
};
export const conditionKeys = Object.keys(conditionLabels);
export const UNVERIFIED = "Not yet verified";

export function defaultConditions(brand: string): PhoneConditions {
  return Object.fromEntries(conditionKeys.filter(key => key !== "trueTone" || brand.toLowerCase() === "apple").map(key => [key, UNVERIFIED]));
}

export function validConditionKey(key: string) {
  return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) && !["__proto__", "prototype", "constructor"].includes(key);
}

export function mergeConditions(base: PhoneConditions, saved: unknown, removed: unknown = []): PhoneConditions {
  const result = { ...base };
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const [key, value] of Object.entries(saved)) {
      if (validConditionKey(key) && typeof value === "string") result[key] = value.trim() || UNVERIFIED;
    }
  }
  if (Array.isArray(removed)) for (const key of removed) if (typeof key === "string") delete result[key];
  return result;
}

export function reportForPhone(brand: string, base: PhoneConditions | undefined, saved?: { conditions?: unknown; field_labels?: unknown; removed_fields?: unknown }) {
  const defaults = { ...defaultConditions(brand), ...base };
  if (brand.toLowerCase() !== "apple") delete defaults.trueTone;
  const conditions = mergeConditions(defaults, saved?.conditions, saved?.removed_fields);
  // Old reports used "Not applicable" for non-Apple True Tone. Hide that legacy field.
  if (brand.toLowerCase() !== "apple") delete conditions.trueTone;
  const labels: Record<string, string> = {};
  if (saved?.field_labels && typeof saved.field_labels === "object") {
    for (const [key, value] of Object.entries(saved.field_labels)) if (validConditionKey(key) && typeof value === "string" && value.trim() && value.length <= 80) labels[key] = value.trim();
  }
  return { conditions, conditionLabels: labels };
}

export function isConditionVerified(value: string) {
  return Boolean(value.trim()) && value.trim().toLowerCase() !== UNVERIFIED.toLowerCase();
}

export function isReportVerified(conditions: PhoneConditions) {
  return Object.values(conditions).length > 0 && Object.values(conditions).every(isConditionVerified);
}
