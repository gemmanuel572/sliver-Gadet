"use server";

import { createClient } from "@/lib/supabase/server";

export type OrderNotification = { id: string; kind: "product" | "request" };

export async function getOrderNotifications(): Promise<{ notifications: OrderNotification[]; error?: never } | { error: string; notifications?: never }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Administrator access is required." };
  const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) return { error: "Administrator access is required." };

  const notifications: OrderNotification[] = [];
  // Read every page: Supabase's row limit must not silently cap the badges.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("customer_orders").select("id,kind")
      .eq("status", "pending").order("id", { ascending: true }).range(offset, offset + 499);
    if (error || !data) return { error: "Notifications are temporarily unavailable. Refresh to try again." };
    notifications.push(...data as OrderNotification[]);
    if (data.length < 500) break;
  }
  return { notifications };
}
