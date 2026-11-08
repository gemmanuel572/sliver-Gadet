"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRegisteredCustomerCount } from "../customer-actions";
import Link from "next/link";

export default function RegisteredCustomers() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const fetching = useRef(false);
  const refresh = useCallback(() => {
    if (fetching.current) return Promise.resolve();
    fetching.current = true;
    return getRegisteredCustomerCount().then(result => {
      if (result.error) { setError(result.error); return; }
      if (typeof result.count === "number") { setCount(result.count); setError(""); setUpdatedAt(new Date().toISOString()); }
    }).catch(() => setError("Could not refresh the customer count. Please try again."))
      .finally(() => { fetching.current = false; setLoading(false); });
  }, []);

  useEffect(() => {
    const poll = () => {
      if (document.hidden) return;
      void refresh();
    };
    poll();
    const interval = window.setInterval(poll, 20000);
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", poll); document.removeEventListener("visibilitychange", poll); };
  }, [refresh]);

  return <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
    <Link href="/admin/customers" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500">
      <h3 className="text-sm text-gray-400">Registered Customers</h3>
      <p role="status" aria-live="polite" className="mt-4 text-4xl font-black text-blue-400">{count !== null ? count.toLocaleString("en-NG") : loading ? "…" : "—"}</p>
      <span className="mt-3 block text-sm font-semibold text-blue-400">Manage Customers →</span>
    </Link>
    <p className="mt-3 text-xs leading-6 text-gray-500">Registered accounts on Supabase. Updates automatically as people create accounts.</p>
    {updatedAt && <p className="mt-2 text-xs text-gray-400">{error ? "Last successful count" : "Updated"}: {new Date(updatedAt).toLocaleTimeString("en-NG")}</p>}
    {error && <p role="alert" className="mt-3 text-sm leading-6 text-yellow-400">{error}</p>}
    <button type="button" onClick={() => void refresh()} className="mt-3 text-sm font-semibold text-blue-400 hover:underline">Refresh Count</button>
  </div>;
}
