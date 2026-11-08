"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCustomerDetails } from "../../customer-actions";
import type { CustomerAccount, CustomerHistoryItem } from "@/lib/customer-directory";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";

export default function CustomerDetails({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [history, setHistory] = useState<{ orders: CustomerHistoryItem[]; page: number; hasMore: boolean } | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void getCustomerDetails(customerId, page).then(result => {
      if (!active) return;
      if (result.error) { setError(result.error); if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED") { setCustomer(null); setHistory(null); } return; }
      if (result.customer) setCustomer(result.customer);
      setHistory(result.history || null); setHistoryError(result.historyError || ""); setError("");
    }).catch(() => { if (active) setError("Could not load this customer. Please try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId, page, revision]);
  return <main className="min-h-screen bg-[#080b12] text-white">
    <header className="border-b border-white/10 px-6 py-6"><div className="mx-auto flex max-w-5xl items-center justify-between gap-5"><h1 className="text-2xl font-black">Customer Details</h1><Link href="/admin/customers" className="text-sm text-blue-400">← Registered Customers</Link></div></header>
    <div className="mx-auto max-w-5xl px-6 py-12">
      <button type="button" onClick={() => { setLoading(true); setRevision(value => value + 1); }} className="mb-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold">Refresh Customer</button>
      {loading && <p role="status" className="mb-5 text-gray-400">Loading customer information…</p>}
      {error && <p role="alert" className="mb-5 text-yellow-400">{error}</p>}
      {customer && <section className="rounded-xl border border-white/10 bg-[#111827] p-6"><h2 className="text-3xl font-black">{customer.name}</h2><dl className="mt-6 grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-gray-400">Email</dt><dd className="mt-2 break-all">{customer.email || "Email not provided"}</dd></div><div><dt className="text-sm text-gray-400">Registered</dt><dd className="mt-2">{new Date(customer.registeredAt).toLocaleString("en-NG")}</dd></div><div><dt className="text-sm text-gray-400">Authentication Provider</dt><dd className="mt-2 capitalize">{customer.providers.join(", ") || "Not provided"}</dd></div></dl></section>}
      {customer && <section className="mt-10"><h2 className="text-2xl font-bold">Orders and Special Phone Requests</h2><p className="mt-3 text-sm text-gray-400">Only records saved for this customer are shown.</p>{historyError && <p role="status" className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-sm text-yellow-300">Account information is available, but order history could not be retrieved. {historyError}</p>}
        {history && <>
          {history.orders.length === 0 ? <p className="mt-5 text-gray-400">No saved orders or special requests on this page.</p> : <div className="mt-5 space-y-4">{history.orders.map(order => <article key={order.id} className="rounded-xl border border-white/10 bg-[#111827] p-5"><p className="text-xs font-bold uppercase tracking-wider text-blue-400">{order.kind === "request" ? "Special Phone Request" : "Customer Order"}</p><h3 className="mt-2 text-lg font-bold">{order.phone}</h3><p className="mt-2 text-sm text-gray-400">{orderStatusLabels[order.status as OrderStatus] || order.status} · {order.quantity !== null ? `Quantity: ${order.quantity} · ` : ""}{new Date(order.createdAt).toLocaleDateString("en-NG")}</p><p className="mt-3 break-all text-xs text-gray-500">Order {order.id}</p></article>)}</div>}
          <div className="mt-6 flex items-center gap-4"><button type="button" disabled={loading || page <= 1} onClick={() => { setPage(page - 1); setLoading(true); }} className="rounded-lg border border-white/20 px-5 py-3 disabled:opacity-40">Previous</button><span className="text-sm text-gray-400">Page {page}</span><button type="button" disabled={loading || !history.hasMore} onClick={() => { setPage(page + 1); setLoading(true); }} className="rounded-lg border border-white/20 px-5 py-3 disabled:opacity-40">Next</button></div>
        </>}
      </section>}
    </div>
  </main>;
}
