"use client";

import { useEffect, useState } from "react";
import { type Product } from "@/data/products";
import { CATALOGUE_UPDATED_KEY } from "@/lib/catalogue-events";

const SEEN_KEY = "silva-seen-phones";

export function useProducts(notify = false) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newPhones, setNewPhones] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;
    let fetching = false;
    const controller = new AbortController();
    let seen = new Set<string>();
    try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { /* Storage is optional. */ }

    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch("/api/products", { cache: "no-store", signal: controller.signal });
        const result = await response.json() as { products: Product[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Phone details could not be loaded.");
        if (!active) return;
        setProducts(result.products);
        setError("");
        if (notify) {
          const unseen = result.products.filter(phone => phone.createdAt && !seen.has(phone.id));
          setNewPhones(current => [...unseen, ...current.filter(phone => result.products.some(item => item.id === phone.id) && !unseen.some(item => item.id === phone.id))]);
          result.products.filter(phone => phone.createdAt).forEach(phone => seen.add(phone.id));
          try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* Keep notifications working in memory. */ }
        }
      } catch (error) {
        if (active) setError(`${error instanceof Error ? error.message : "Phone details could not be loaded."} We’ll try again automatically.`);
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    }
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 20000);
    const onFocus = () => { void refresh(); };
    const onStorage = (event: StorageEvent) => { if (event.key === CATALOGUE_UPDATED_KEY) void refresh(); };
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("catalogue-changed", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("catalogue-changed", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [notify]);

  return { products, loading, error, newPhones, dismissNotification: () => setNewPhones([]) };
}
