"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getCustomerDirectory } from "../customer-actions";
import type { CustomerDirectoryPage } from "@/lib/customer-directory";

export default function CustomerDirectory() {
  const [directory, setDirectory] = useState<CustomerDirectoryPage | null>(null);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true; let fetching = false;
    const load = () => {
      if (fetching) return;
      fetching = true;
      void getCustomerDirectory(page, query).then(result => {
        if (!active) return;
        if (result.error) { setError(result.error); if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED") setDirectory(null); return; }
        if (result.directory) { setDirectory(result.directory); setError(""); }
      }).catch(() => { if (active) setError("Could not load customers. Please try again."); })
        .finally(() => { fetching = false; if (active) setLoading(false); });
    };
    load();
    const refresh = () => { if (!document.hidden) load(); };
    const interval = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [page, query, revision]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setPage(1); setQuery(input.trim()); setRevision(value => value + 1);
  }
  const pages = directory ? Math.max(1, Math.ceil(directory.matching / directory.perPage)) : 1;
  return <main className="min-h-screen bg-[#080b12] text-white">
    <header className="border-b border-white/10 px-6 py-6"><div className="mx-auto flex max-w-7xl items-center justify-between gap-5"><h1 className="text-2xl font-black">SILVA <span className="text-blue-500">CUSTOMERS</span></h1><Link href="/admin" className="text-sm text-blue-400">← Admin Dashboard</Link></div></header>
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><h2 className="text-3xl font-black">Registered Customers</h2><p className="mt-3 text-gray-400">Accounts registered through your website. Refreshed automatically every 20 seconds.</p><p className="mt-4 text-xl font-bold text-blue-400">{directory ? `${directory.total.toLocaleString("en-NG")} registered accounts` : "Total unavailable until accounts load"}</p></div><button type="button" onClick={() => { setLoading(true); setRevision(value => value + 1); }} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold">Refresh Customers</button></div>
      <form onSubmit={search} className="mt-8 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><label htmlFor="customer-query" className="mb-2 block text-sm font-semibold">Search all customers by name or email</label><input id="customer-query" type="search" maxLength={200} value={input} onChange={event => setInput(event.target.value)} placeholder="Name or email address" className="w-full rounded-lg border border-white/15 bg-[#111827] px-4 py-3 outline-none focus:border-blue-500" /></div><button type="submit" className="rounded-lg bg-blue-600 px-6 py-3 font-semibold">Search</button>{query && <button type="button" onClick={() => { setInput(""); setQuery(""); setPage(1); setLoading(true); }} className="px-4 py-3 text-blue-400">Clear Search</button>}</form>
      {loading && <p role="status" className="mt-5 text-gray-400">Loading customer records…</p>}
      {error && <p role="alert" className="mt-5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-300">{error}{directory ? " Showing the last retrieved records." : ""}</p>}
      {directory && <>
        <p className="mt-5 text-sm text-gray-400">{directory.matching.toLocaleString("en-NG")} {query ? "matching accounts" : "accounts"} · Page {directory.page} of {pages}</p>
        {directory.customers.length === 0 ? <p className="mt-6 text-gray-400">{query ? "No registered customers match your search." : "No registered accounts were returned for this page."}</p> : <div className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-[#111827]"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-gray-400"><tr>{["Customer", "Email", "Registered", "Provider", ""].map(label => <th key={label} scope="col" className="whitespace-nowrap px-5 py-4">{label}</th>)}</tr></thead><tbody>{directory.customers.map(customer => <tr key={customer.id} className="border-b border-white/10 last:border-0"><td className="px-5 py-5 font-semibold"><Link href={`/admin/customers/${customer.id}`} className="text-blue-400 hover:underline">{customer.name}</Link></td><td className="break-all px-5 py-5 text-gray-300">{customer.email || "Email not provided"}</td><td className="whitespace-nowrap px-5 py-5 text-gray-300">{new Date(customer.registeredAt).toLocaleDateString("en-NG")}</td><td className="px-5 py-5 capitalize text-gray-300">{customer.providers.join(", ") || "Not provided"}</td><td className="px-5 py-5"><Link href={`/admin/customers/${customer.id}`} className="whitespace-nowrap text-blue-400 hover:underline">View Details →</Link></td></tr>)}</tbody></table></div>}
        <div className="mt-6 flex flex-wrap items-center gap-4"><button type="button" disabled={loading || directory.page <= 1} onClick={() => { setPage(directory.page - 1); setLoading(true); }} className="rounded-lg border border-white/20 px-5 py-3 disabled:opacity-40">Previous</button><button type="button" disabled={loading || directory.page >= pages} onClick={() => { setPage(directory.page + 1); setLoading(true); }} className="rounded-lg border border-white/20 px-5 py-3 disabled:opacity-40">Next</button><span className="text-sm text-gray-500">Up to {directory.perPage} accounts per page</span></div>
      </>}
    </div>
  </main>;
}
