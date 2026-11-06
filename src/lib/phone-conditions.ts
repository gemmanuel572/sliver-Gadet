import type { Product } from "@/data/products";

export type PhoneConditions = Product["conditions"];
export const conditionLabels: Record<keyof PhoneConditions, string> = {
  batteryHealth: "Battery Health", screen: "Screen Condition", faceIdOrFingerprint: "Face ID / Fingerprint",
  cameras: "Cameras", speakers: "Speakers", microphone: "Microphone", chargingPort: "Charging Port",
  network: "Network", wifi: "Wi-Fi", bluetooth: "Bluetooth", trueTone: "True Tone",
};
export const conditionKeys = Object.keys(conditionLabels) as (keyof PhoneConditions)[];
export const UNVERIFIED = "Not yet verified";

export function defaultConditions(brand: string): PhoneConditions {
  return Object.fromEntries(conditionKeys.map(key => [key, key === "trueTone" && brand.toLowerCase() !== "apple" ? "Not applicable" : UNVERIFIED])) as PhoneConditions;
}

export function mergeConditions(base: PhoneConditions, saved: unknown): PhoneConditions {
  const result = { ...base };
  if (!saved || typeof saved !== "object") return result;
  for (const key of conditionKeys) {
    const value = (saved as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return result;
}

export function isConditionVerified(value: string) {
  return Boolean(value.trim()) && value.trim().toLowerCase() !== UNVERIFIED.toLowerCase();
}

export function isReportVerified(conditions: PhoneConditions) {
  return conditionKeys.every(key => isConditionVerified(conditions[key]));
}
