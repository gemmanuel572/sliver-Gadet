import "server-only";

import { createClient } from "@supabase/supabase-js";

export class CustomerCountError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CustomerCountError";
  }
}

function adminConfiguration() {
  // Read at request time: Netlify must provide this variable to its Functions runtime.
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!key) throw new CustomerCountError("KEY_MISSING", "Set SUPABASE_SECRET_KEY in Netlify’s Production environment with Functions scope, then redeploy.");
  if (!url) throw new CustomerCountError("URL_MISSING", "NEXT_PUBLIC_SUPABASE_URL is missing from the server environment.");
  if (key.startsWith("sb_publishable_") || key === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new CustomerCountError("PUBLIC_KEY", "SUPABASE_SECRET_KEY contains a publishable key. Replace it with the same project’s secret key (sb_secret_…) in Netlify’s Production Functions environment, then redeploy.");
  }
  let project: URL;
  try { project = new URL(url); }
  catch { throw new CustomerCountError("URL_INVALID", "NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL."); }

  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) {
    // Legacy service_role JWTs are supported, but anon/session JWTs are never admin keys.
    let payload: { role?: string; ref?: string };
    try {
      if (key.split(".").length !== 3) throw new Error();
      payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      if (!payload || typeof payload !== "object") throw new Error();
    } catch { throw new CustomerCountError("KEY_INVALID", "SUPABASE_SECRET_KEY must contain an actual secret key, without quotes or a Bearer prefix. A legacy service_role key is also supported."); }
    if (payload.role !== "service_role") throw new CustomerCountError("KEY_ROLE", "The configured key is not a service_role key. Use the project’s secret key (sb_secret_…) or its legacy service_role key.");
    if (payload.ref && project.hostname.endsWith(".supabase.co") && payload.ref !== project.hostname.split(".")[0]) {
      throw new CustomerCountError("PROJECT_MISMATCH", "The server key and NEXT_PUBLIC_SUPABASE_URL belong to different projects. Use the key from this website’s Supabase project.");
    }
  }
  return { url, key };
}

export function createSupabaseAdminClient() {
  const { url, key } = adminConfiguration();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, debug: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) },
  });
}

export async function countRegisteredAuthUsers(): Promise<number> {
  const client = createSupabaseAdminClient();

  async function page(pageNumber: number, perPage: number) {
    const { data, error } = await client.auth.admin.listUsers({ page: pageNumber, perPage });
    if (error) {
      if (error.status === 401 || error.status === 403) throw new CustomerCountError("KEY_REJECTED", "Supabase rejected the server key. Check that Netlify’s Production Functions secret key is valid, unrevoked, and belongs to the configured project, then redeploy.");
      throw new CustomerCountError("AUTH_UNAVAILABLE", "Supabase Auth is temporarily unavailable. The customer count could not be refreshed.");
    }
    if (!Array.isArray(data.users)) throw new CustomerCountError("COUNT_INVALID", "Supabase did not return a valid account list. Please retry.");
    return data;
  }

  const first = await page(1, 1);
  if (Number.isSafeInteger(first.total) && first.total >= first.users.length && (first.total === 0 || first.users.length > 0)) {
    return first.total;
  }
  // Some Auth responses omit the pagination headers; this SDK then defaults total to 0.
  // Count actual pages in that case. Never turn a failed later page into a partial total.
  let count = 0;
  for (let number = 1; ; number++) {
    const current = await page(number, 1000);
    count += current.users.length;
    if (current.users.length < 1000) return count;
  }
}
