"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { editInventoryPhone, getAdminPhones, removeInventoryPhone, setPhoneBooked } from "../actions";
import { notifyCatalogueChanged } from "@/lib/catalogue-events";
import type { InventoryPhone as Phone } from "@/lib/inventory";

export default function PhoneInventory() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Phone | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const refresh = useCallback(() => {
    return getAdminPhones().then(result => {
      if (result.error) setError(result.error);
      else { setPhones(result.phones || []); setError(""); }
    }).catch(() => setError("Could not load inventory. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => { void refresh(); };
    window.addEventListener("admin-phones-changed", onRefresh);
    return () => window.removeEventListener("admin-phones-changed", onRefresh);
  }, [refresh]);

  async function changeAvailability(phone: Phone) {
    if (!phone.booked && !window.confirm(`Mark ${phone.name} as booked and remove it from the customer store?`)) return;
    setBusy(phone.id); setError(""); setMessage("");
    try {
      const result = await setPhoneBooked(phone.id, !phone.booked);
      if (result.error) { setError(result.error); return; }
      setPhones(current => current.map(item => item.id === phone.id ? { ...item, booked: !phone.booked } : item));
      setMessage(phone.booked ? `${phone.name} is available in the store again.` : `${phone.name} is booked and hidden from the store. Open customer pages update within 20 seconds.`);
      notifyCatalogueChanged();
    } catch { setError("Could not change availability. Please try again."); }
    finally { setBusy(null); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(editing.id); setError(""); setMessage("");
    try {
      const result = await editInventoryPhone(editing.id, form);
      if (result.error) { setError(result.error); return; }
      setEditing(null); setMessage("Phone details saved. The customer store will update automatically.");
      notifyCatalogueChanged(); await refresh();
      window.dispatchEvent(new Event("admin-phones-changed"));
    } catch { setError("Could not save phone details. Please try again."); }
    finally { setBusy(null); }
  }

  async function changeRemoval(phone: Phone) {
    if (!phone.removed && !window.confirm(`Remove ${phone.name} from the customer store? Its records, photos and order history will be kept, and you can restore it later.`)) return;
    setBusy(phone.id); setError(""); setMessage("");
    try {
      const result = await removeInventoryPhone(phone.id, !phone.removed);
      if (result.error) { setError(result.error); return; }
      setPhones(current => current.map(item => item.id === phone.id ? { ...item, removed: !phone.removed } : item));
      setMessage(phone.removed
        ? phone.booked ? "Phone restored, but remains hidden because it is booked. Choose Make Available Again to display it."
          : !phone.published ? "Phone restored, but remains hidden because it has not been published."
            : "Phone restored to the store. Open customer pages update within 20 seconds."
        : "Phone removed from the store. Open customer pages update within 20 seconds. Enable Show removed phones to restore it.");
      notifyCatalogueChanged();
      window.dispatchEvent(new Event("admin-phones-changed"));
    } catch { setError("Could not update this phone. Please try again."); }
    finally { setBusy(null); }
  }

  return <section id="phone-inventory" className="mt-16 scroll-mt-6">
    <h2 className="text-2xl font-black">Phone Inventory</h2>
    <p className="mt-3 text-gray-400">Add phones, edit details, confirm bookings or remove a listing. Removed phones can be restored; order history and photos are kept.</p>
    <Link href="#phone-upload-card" className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold">Add a Phone</Link>
    {!loading && !error && <p className="mt-3 text-sm text-blue-400">{phones.filter(phone => phone.published && !phone.booked && !phone.removed).length} available · {phones.filter(phone => phone.booked && !phone.removed).length} booked · {phones.filter(phone => phone.removed).length} removed</p>}
    <label className="mt-4 flex items-center gap-2 text-sm text-gray-400"><input type="checkbox" checked={showRemoved} onChange={event => setShowRemoved(event.target.checked)} />Show removed phones</label>
    {loading && <p className="mt-6" role="status">Loading phones…</p>}
    {error && <div className="mt-6"><p role="alert" className="text-red-400">{error}</p><button type="button" onClick={() => void refresh()} className="mt-2 text-blue-400 underline">Retry loading inventory</button></div>}
    {message && <p role="status" className="mt-6 text-green-400">{message}</p>}
    {editing && <form key={editing.id} onSubmit={saveEdit} className="mt-6 rounded-xl border border-blue-500/30 bg-[#111827] p-6">
      <h3 className="text-xl font-bold">Edit {editing.name}</h3>
      <fieldset disabled={busy !== null} className="mt-5 grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        {[
          { name: "phoneType", label: "Phone name", value: editing.name, max: 120 },
          { name: "brand", label: "Brand", value: editing.brand, max: 80 },
          { name: "price", label: "Starting price (₦)", value: editing.price, max: undefined },
          { name: "colors", label: "Colours, separated by commas", value: editing.colors.join(", "), max: 2400 },
          { name: "storage", label: "Storage options, separated by commas", value: editing.storage.join(", "), max: 2400 },
        ].map(field => <label key={field.name} className="text-sm font-semibold">{field.label}<input name={field.name} type={field.name === "price" ? "number" : "text"} min={field.name === "price" ? "0.01" : undefined} max={field.name === "price" ? "1000000000" : undefined} step={field.name === "price" ? "0.01" : undefined} required maxLength={field.max} defaultValue={field.value} className="mt-2 w-full rounded-lg border border-white/20 bg-[#080b12] px-4 py-3 outline-none focus:border-blue-500" /></label>)}
        <label className="text-sm font-semibold sm:col-span-2">Description<textarea name="description" maxLength={2000} rows={3} defaultValue={editing.description} className="mt-2 w-full rounded-lg border border-white/20 bg-[#080b12] px-4 py-3" /></label>
        <div className="flex gap-3 sm:col-span-2"><button type="submit" className="rounded-lg bg-blue-600 px-5 py-3 font-semibold">{busy ? "Saving…" : "Save Changes"}</button><button type="button" onClick={() => setEditing(null)} className="px-5 py-3 text-gray-400">Cancel</button></div>
      </fieldset>
    </form>}
    <div className="mt-8 space-y-4">{phones.filter(phone => showRemoved || !phone.removed).map(phone => <div key={phone.id} className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-white/10 bg-[#111827] p-5">
      <div><h3 className="font-bold">{phone.name}</h3><p className="mt-2 text-blue-400">{phone.price > 0 ? `₦${phone.price.toLocaleString("en-NG")}` : "Price not set"}</p><p className={`mt-2 text-sm ${phone.booked ? "text-yellow-400" : "text-gray-400"}`}>{phone.removed ? "Removed — hidden from store" : phone.booked ? "Booked — hidden from store" : phone.published ? "Available in store" : "Unpublished"}</p></div>
      <div className="flex flex-wrap gap-3">
        {phone.published && !phone.booked && !phone.removed && <Link href={`/products/${phone.id}`} className="rounded-lg border border-blue-500 px-5 py-3 text-sm text-blue-400">View Product →</Link>}
        <button type="button" disabled={busy !== null} onClick={() => { setEditing(phone); setError(""); setMessage(""); }} className="rounded-lg border border-blue-500 px-5 py-3 text-sm text-blue-400 disabled:opacity-50">Edit Phone</button>
        {phone.published && !phone.removed && <button type="button" disabled={busy !== null} onClick={() => void changeAvailability(phone)} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{busy === phone.id ? "Saving…" : phone.booked ? "Make Available Again" : "Mark as Booked"}</button>}
        <button type="button" disabled={busy !== null} onClick={() => void changeRemoval(phone)} className="rounded-lg border border-white/20 px-5 py-3 text-sm text-gray-300 disabled:opacity-50">{phone.removed ? "Restore Phone" : "Remove Phone"}</button>
      </div>
    </div>)}</div>
  </section>;
}
