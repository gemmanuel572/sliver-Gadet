"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { advanceOrder, getOrders, markRequestAvailable, verifyDelivery } from "@/app/orders/actions";
import { orderStatusLabels, type CustomerOrder } from "@/lib/orders";
import PaymentDetails from "./payment-details";
import { MarkOrderNotificationsRead, OrderNotificationBadge } from "@/app/admin/components/order-notifications";

export default function OrdersPanel({ admin = false, requestsOnly = false }: { admin?: boolean; requestsOnly?: boolean }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const refresh = useCallback(() => getOrders(admin).then(result => {
    if (result.error) { setError(result.error); return; }
    setSignedIn(Boolean(result.signedIn));
    setUnavailable("unavailable" in result && Boolean(result.unavailable));
    if (result.orders) setOrders(result.orders);
    setError("");
  }).catch(() => {
    if (admin) setError("Could not load orders. Please try again.");
    else { setUnavailable(true); setError(""); }
  })
    .finally(() => setLoading(false)), [admin]);

  useEffect(() => {
    let active = true;
    let fetching = false;
    function poll() {
      if (!active || fetching || document.hidden) return;
      fetching = true;
      void refresh().finally(() => { fetching = false; });
    }
    poll();
    const interval = window.setInterval(poll, 20000);
    window.addEventListener("focus", poll);
    window.addEventListener("orders-changed", poll);
    window.addEventListener("admin-phones-changed", poll);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", poll); window.removeEventListener("orders-changed", poll); window.removeEventListener("admin-phones-changed", poll); };
  }, [refresh]);

  async function act(order: CustomerOrder, action: "processing" | "awaiting_confirmation" | "verify") {
    const prompt = action === "verify" ? "Have you received this phone? Confirm only after receiving your delivery."
      : action === "awaiting_confirmation" ? "Confirm that this order has been delivered. The customer will be asked to verify receipt."
      : "Confirm this booking? Its phone listing will be hidden from the store.";
    if (!window.confirm(prompt)) return;
    setBusy(order.id); setError(""); setMessage("");
    try {
      const result = action === "verify" ? await verifyDelivery(order.id) : await advanceOrder(order.id, action);
      if (result.error) { setError(result.error); return; }
      setOrders(current => current.map(item => item.id === order.id ? { ...item, status: action === "verify" ? "completed" : action } : item));
      setMessage(action === "verify" ? "Delivery verified. Your order has moved to history." : action === "awaiting_confirmation" ? "The customer will see a Verify Delivery prompt on their homepage." : "Booking confirmed and phone hidden from the store.");
      if (admin) window.dispatchEvent(new Event("admin-phones-changed"));
      window.dispatchEvent(new Event("orders-changed"));
    } catch { setError("Could not update this order. Please try again."); }
    finally { setBusy(null); }
  }

  function openUpload(order: CustomerOrder) {
    window.dispatchEvent(new CustomEvent("upload-requested-phone", { detail: { id: order.id, name: order.phone_name, color: order.details.color, storage: order.details.storage } }));
  }

  async function requestAvailable(order: CustomerOrder) {
    setBusy(order.id); setError(""); setMessage("");
    try {
      const result = await markRequestAvailable(order.id);
      if (result.error) { setError(result.error); return; }
      setOrders(current => current.map(item => item.id === order.id ? { ...item, request_available: true } : item));
      setMessage(`${order.phone_name} is available. Upload its photos and details to publish it on the website.`);
      openUpload(order);
      window.dispatchEvent(new Event("orders-changed"));
    } catch { setError("Could not update this special request. Please try again."); }
    finally { setBusy(null); }
  }

  const relevant = requestsOnly ? orders.filter(order => order.kind === "request") : orders;
  const active = relevant.filter(order => order.status !== "completed");
  const visible = history ? relevant.filter(order => order.status === "completed") : active;
  const awaiting = active.filter(order => order.status === "awaiting_confirmation");

  return <section id={admin ? requestsOnly ? "special-requests" : "customer-orders" : "my-orders"} className={admin ? "mt-16 scroll-mt-6" : "mx-auto w-full max-w-7xl scroll-mt-6 px-6 py-10"}>
    <h2 className="text-2xl font-black">{admin ? requestsOnly ? "Special Requests" : "Customer Orders" : "My Orders"}{admin && <OrderNotificationBadge kind={requestsOnly ? "request" : "product"} />}</h2>
    {admin && !loading && !error && <MarkOrderNotificationsRead kind={requestsOnly ? "request" : "product"} />}
    {admin && requestsOnly && <p className="mt-3 text-sm text-gray-400">Requests stay active until delivery is verified. When you source a phone, choose Already Available and upload it to the website.</p>}
    {loading && <p role="status" className="mt-4 text-gray-400">Loading orders…</p>}
    {!admin && unavailable && <div role="status" className="mt-4 rounded-xl border border-white/10 bg-[#111827] p-5"><p className="text-gray-300">Order tracking is temporarily unavailable.</p><p className="mt-2 text-sm text-gray-400">You can contact SILVA for an update on your order.</p><a href="https://wa.me/2348137596850" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-blue-400 underline">Chat with SILVA on WhatsApp</a><button type="button" onClick={() => void refresh()} className="ml-5 text-sm text-blue-400 underline">Try Again</button></div>}
    {error && <div className="mt-4 rounded-xl border border-white/10 bg-[#111827] p-5">
      <p role="alert" className="text-gray-300">{admin ? `${requestsOnly ? "Special requests" : "Customer orders"} could not be loaded. Try refreshing.` : error}</p>
      {admin && <details className="mt-3 text-sm text-gray-400"><summary className="cursor-pointer">View details</summary><p className="mt-2 break-words">{error}</p></details>}
      <button type="button" onClick={() => void refresh()} className="mt-3 text-blue-400 underline">{requestsOnly ? "Refresh Requests" : "Refresh Orders"}</button>
    </div>}
    {!loading && !signedIn && !error && !unavailable && <p className="mt-4 text-gray-400"><Link href="/login?next=%2F%23my-orders" className="text-blue-400 underline">Sign in</Link> to view orders and verify your deliveries.</p>}
    {message && <p role="status" className="mt-4 text-green-400">{message}</p>}
    {signedIn && !unavailable && <>
      {!admin && active.length > 0 && <div className="mt-5"><PaymentDetails /></div>}
      {!admin && awaiting.length > 0 && <div role="status" className="mt-5 rounded-xl border border-blue-500 bg-blue-600/15 p-5"><p className="font-bold">SILVA has marked {awaiting.length === 1 ? "your order" : `${awaiting.length} orders`} as delivered.</p><p className="mt-2 text-sm text-gray-300">Press Verify Delivery below once you have received your phone.</p>{history && <button type="button" onClick={() => setHistory(false)} className="mt-3 text-blue-400 underline">View deliveries to verify</button>}</div>}
      <div className="mt-5 flex gap-3"><button type="button" onClick={() => setHistory(false)} aria-pressed={!history} className={`rounded-lg px-4 py-2 ${!history ? "bg-blue-600" : "border border-white/20"}`}>Active Orders ({active.length})</button><button type="button" onClick={() => setHistory(true)} aria-pressed={history} className={`rounded-lg px-4 py-2 ${history ? "bg-blue-600" : "border border-white/20"}`}>Order History</button></div>
      {visible.length === 0 && <p className="mt-5 text-gray-400">{history ? "No completed deliveries yet." : "No active orders."}</p>}
      <div className="mt-6 space-y-4">{visible.map(order => <article key={order.id} className="rounded-xl border border-white/10 bg-[#111827] p-5">
        <div className="flex flex-wrap justify-between gap-4"><div><h3 className="text-lg font-bold">{order.phone_name}</h3><p className="mt-1 break-all text-xs text-gray-500">Order {order.id}</p></div><p className={order.status === "awaiting_confirmation" ? "text-yellow-400" : "text-blue-400"}>{orderStatusLabels[order.status]}</p></div>
        <p className="mt-3 text-sm text-gray-300">{order.details.color} · {order.details.storage} · {order.details.condition} · Quantity: {order.details.quantity}</p>
        <p className="mt-2 text-sm text-gray-400">{order.kind === "request" ? "Special phone request — price to be confirmed" : `Listed starting price per phone: ₦${Number(order.listed_price).toLocaleString("en-NG")}`}</p>
        <p className="mt-2 text-xs text-gray-500">Placed {new Date(order.created_at).toLocaleDateString("en-NG")}</p>
        {order.kind === "request" && <p className="mt-2 text-sm text-blue-400">{order.published_product_id ? "Requested phone uploaded to the website" : order.request_available ? "Phone sourced — website upload pending" : "Waiting for SILVA to source this phone"}</p>}
        {admin && <div className="mt-4 space-y-2 break-words text-sm text-gray-300"><p>Customer: {order.details.customerName} · {order.details.phone}</p><p>Account: {order.customer_email || order.customer_id}</p><p>Delivery: {order.details.address}, {order.details.location} · {order.details.deliveryPreference}</p>{(order.details.alternativeName || order.details.alternativePhone) && <p>Alternative contact: {order.details.alternativeName} · {order.details.alternativePhone}</p>}{order.details.note && <p className="whitespace-pre-wrap">Note: {order.details.note}</p>}</div>}
        <div className="mt-4 flex flex-wrap gap-3">
          {admin && order.kind === "request" && ["pending", "processing"].includes(order.status) && !order.request_available && <button type="button" disabled={busy !== null} onClick={() => void requestAvailable(order)} className="rounded-lg bg-blue-600 px-4 py-3 font-semibold disabled:opacity-50">Already Available — Upload Phone</button>}
          {admin && order.kind === "request" && order.request_available && !order.published_product_id && ["pending", "processing"].includes(order.status) && <button type="button" disabled={busy !== null} onClick={() => openUpload(order)} className="rounded-lg bg-blue-600 px-4 py-3 font-semibold disabled:opacity-50">Upload Requested Phone</button>}
          {order.published_product_id && ["pending", "processing"].includes(order.status) && <Link href={`/products/${order.published_product_id}`} className="rounded-lg border border-blue-500 px-4 py-3 text-blue-400">View Uploaded Phone</Link>}
          {admin && order.status === "pending" && <button type="button" disabled={busy !== null} onClick={() => void act(order, "processing")} className="rounded-lg border border-blue-500 px-4 py-3 text-blue-400 disabled:opacity-50">Confirm Booking</button>}
          {admin && ["pending", "processing"].includes(order.status) && <button type="button" disabled={busy !== null} onClick={() => void act(order, "awaiting_confirmation")} className="rounded-lg bg-blue-600 px-4 py-3 font-semibold disabled:opacity-50">{busy === order.id ? "Saving…" : "Mark Delivered"}</button>}
          {!admin && order.status === "awaiting_confirmation" && <button type="button" disabled={busy !== null} onClick={() => void act(order, "verify")} className="rounded-lg bg-green-600 px-5 py-3 font-bold disabled:opacity-50">{busy === order.id ? "Verifying…" : "Verify Delivery"}</button>}
        </div>
      </article>)}</div>
    </>}
  </section>;
}
