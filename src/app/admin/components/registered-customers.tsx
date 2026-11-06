"use client";

import { useCallback, useEffect, useState } from "react";
import { getRegisteredCustomerCount } from "../customer-actions";

export default function RegisteredCustomers() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(() => getRegisteredCustomerCount().then(result => {
    if (result.error) { setError(result.error); return; }
    if (typeof result.count === "number") { setCount(result.count); setError(""); }
  }).catch(() => setError("Could not refresh the customer count. Please try again."))
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    let fetching = false;
    const poll = () => {
      if (fetching || document.hidden) return;
      fetching = true;
      void refresh().finally(() => { fetching = false; });
    };
    poll();
    const interval = window.setInterval(poll, 20000);
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", poll); document.removeEventListener("visibilitychange", poll); };
  }, [refresh]);

  return <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
    <h3 className="text-sm text-gray-400">Registered Customers</h3>
    <p role="status" aria-live="polite" className="mt-4 text-4xl font-black text-blue-400">{count !== null ? count.toLocaleString("en-NG") : loading ? "…" : "—"}</p>
    <p className="mt-3 text-xs leading-6 text-gray-500">Registered accounts on Supabase. Updates automatically as people create accounts.</p>
    {error && <p role="alert" className="mt-3 text-sm leading-6 text-yellow-400">{error}</p>}
    <button type="button" onClick={() => void refresh()} className="mt-3 text-sm font-semibold text-blue-400 hover:underline">Refresh Count</button>
  </div>;
}
