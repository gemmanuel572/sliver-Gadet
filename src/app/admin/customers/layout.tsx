import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function CustomerAdminGate({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Fcustomers");
  const { data: admin, error: roleError } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (roleError || !admin) return <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#080b12] px-6 text-white"><h1 className="text-3xl font-black">Access Denied</h1><p className="text-gray-400">Administrator access is required to view customer records.</p><Link href="/" className="text-blue-400">Return to Store</Link></main>;
  return children;
}

export default function CustomerAdminLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#080b12] text-white">Checking administrator access…</main>}><CustomerAdminGate>{children}</CustomerAdminGate></Suspense>;
}
