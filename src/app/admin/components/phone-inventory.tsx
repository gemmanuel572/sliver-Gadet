"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAdminPhones, setPhoneBooked } from "../actions";

type Phone = { id: string; name: string; price: number; published: boolean; booked: boolean };

export default function PhoneInventory() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    } catch { setError("Could not change availability. Please try again."); }
    finally { setBusy(null); }
  }

  return <section id="phone-inventory" className="mt-16 scroll-mt-6">
    <h2 className="text-2xl font-black">Phone Inventory</h2>
    <p className="mt-3 text-gray-400">After confirming a booking with a customer, mark the phone as booked to remove it from the store. You can make it available again if the booking is cancelled.</p>
    <p className="mt-3 text-sm text-blue-400">{phones.filter(phone => phone.published && !phone.booked).length} available · {phones.filter(phone => phone.booked).length} booked</p>
    {loading && <p className="mt-6" role="status">Loading phones…</p>}
    {error && <div className="mt-6"><p role="alert" className="text-red-400">{error}</p><button type="button" onClick={() => void refresh()} className="mt-2 text-blue-400 underline">Retry loading inventory</button></div>}
    {message && <p role="status" className="mt-6 text-green-400">{message}</p>}
    <div className="mt-8 space-y-4">{phones.map(phone => <div key={phone.id} className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-white/10 bg-[#111827] p-5">
      <div><h3 className="font-bold">{phone.name}</h3><p className="mt-2 text-blue-400">{phone.price > 0 ? `₦${phone.price.toLocaleString("en-NG")}` : "Price not set"}</p><p className={`mt-2 text-sm ${phone.booked ? "text-yellow-400" : "text-gray-400"}`}>{phone.booked ? "Booked — hidden from store" : phone.published ? "Available in store" : "Unpublished"}</p></div>
      <div className="flex flex-wrap gap-3">
        {phone.published && !phone.booked && <Link href={`/products/${phone.id}`} className="rounded-lg border border-blue-500 px-5 py-3 text-sm text-blue-400">View Product →</Link>}
        {phone.published && <button type="button" disabled={busy !== null} onClick={() => void changeAvailability(phone)} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{busy === phone.id ? "Saving…" : phone.booked ? "Make Available Again" : "Mark as Booked"}</button>}
      </div>
    </div>)}</div>
  </section>;
}
