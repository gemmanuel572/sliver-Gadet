export const CATALOGUE_UPDATED_KEY = "silva-catalogue-updated";

// Broadcast only a refresh signal. Reports are always fetched from the server.
export function notifyCatalogueChanged() {
  window.dispatchEvent(new Event("catalogue-changed"));
  try { window.localStorage.setItem(CATALOGUE_UPDATED_KEY, crypto.randomUUID()); }
  catch { /* Other browsers and tabs still refresh on their regular interval. */ }
}
