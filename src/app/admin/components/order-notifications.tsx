"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getOrderNotifications, type OrderNotification } from "../notification-actions";

type Kind = OrderNotification["kind"];
type NotificationState = { counts: Record<Kind, number>; loading: boolean; error: boolean; markRead: (kind: Kind) => void };
const Notifications = createContext<NotificationState | null>(null);

export function OrderNotificationsProvider({ adminId, children }: { adminId: string; children: ReactNode }) {
  const [items, setItems] = useState<OrderNotification[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const seenRef = useRef<string[]>([]);
  const storageKey = `silva-admin-order-notifications:${adminId}`;

  useEffect(() => {
    let active = true;
    let fetching = false;
    const readSeen = () => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
        seenRef.current = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
        setSeen(seenRef.current);
      } catch { /* Notifications still work when browser storage is unavailable. */ }
    };
    readSeen();
    async function refresh() {
      if (!active || fetching || document.hidden) return;
      fetching = true;
      try {
        const result = await getOrderNotifications();
        if (!active) return;
        if (result.error) { setError(true); return; }
        setItems(result.notifications || []);
        setError(false);
      } catch { if (active) setError(true); }
      finally { fetching = false; if (active) setLoading(false); }
    }
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) readSeen(); };
    const onVisible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 20000);
    window.addEventListener("focus", refresh);
    window.addEventListener("orders-changed", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("orders-changed", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [storageKey]);

  const markRead = useCallback((kind: Kind) => {
    const next = [...new Set([...seenRef.current, ...items.filter(item => item.kind === kind).map(item => item.id)])];
    seenRef.current = next;
    setSeen(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current session working. */ }
  }, [items, storageKey]);
  const read = new Set(seen);
  const counts = { product: 0, request: 0 };
  for (const item of items) if (!read.has(item.id)) counts[item.kind]++;
  return <Notifications.Provider value={{ counts, loading, error, markRead }}>{children}</Notifications.Provider>;
}

export function OrderNotificationBadge({ kind }: { kind: Kind }) {
  const state = useContext(Notifications);
  if (!state) return null;
  if (state.error) return <span role="status" className="ml-2 text-xs font-normal text-gray-400" title="Notification count unavailable; existing counts may be outdated">Notifications unavailable</span>;
  if (state.loading || !state.counts[kind]) return null;
  const count = state.counts[kind];
  return <span aria-live="polite" aria-atomic="true" aria-label={`${count} new ${kind === "product" ? "customer orders" : "special requests"}`} className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{count > 99 ? "99+" : count}</span>;
}

export function OrderNotificationLink({ kind, className, children }: { kind: Kind; className?: string; children: ReactNode }) {
  const state = useContext(Notifications);
  return <Link href={kind === "product" ? "#customer-orders" : "#special-requests"} className={className} onClick={() => state?.markRead(kind)}>{children}</Link>;
}

export function MarkOrderNotificationsRead({ kind }: { kind: Kind }) {
  const state = useContext(Notifications);
  if (!state || !state.counts[kind] || state.error) return null;
  return <button type="button" onClick={() => state.markRead(kind)} className="mt-3 text-sm text-blue-400 underline">Mark notifications as read</button>;
}
