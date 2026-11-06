"use client";

import { useRef, useState } from "react";
import { placeOrder } from "@/app/orders/actions";

export function useOrderSubmission() {
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const submission = useRef<{ fingerprint: string; id: string } | null>(null);

  async function saveOrder(form: FormData, productId: string | null) {
    if (locked.current) return { error: "Your order is being saved. Please wait." };
    locked.current = true; setSaving(true);
    const fingerprint = JSON.stringify([productId, Array.from(form.entries())]);
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, id: crypto.randomUUID() };
    try { return await placeOrder(form, productId, submission.current.id); }
    catch { return { error: "Could not save your order. Please try again." }; }
    finally { locked.current = false; setSaving(false); }
  }
  return { saveOrder, saving };
}
