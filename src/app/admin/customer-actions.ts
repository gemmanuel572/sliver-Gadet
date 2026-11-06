"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function getRegisteredCustomerCount() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in to view registered customers." };
  const { data: admin, error: adminError } = await supabase.from("admin_users")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) return { error: "Administrator access is required." };
  // This key is used only on the server, after checking administrator access.
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serverKey || !url) return { error: "Customer counting needs server access to Supabase Auth. Add SUPABASE_SECRET_KEY to the server environment. No SQL setup is required." };
  const authAdmin = createAdminClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await authAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) return { error: "Could not read the customer count from Supabase Auth. Check the server key and try again." };
  if (!Number.isSafeInteger(data.total) || data.total < data.users.length) return { error: "Supabase did not return a valid customer count. Please try again." };
  return { count: data.total };
}
