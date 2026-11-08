// Admin-only diagnostics: identify the failed dependency without returning raw SQL errors.
export function databaseSetupError(feature: string, table: string, error: { code?: string }) {
  const code = error.code || "UNKNOWN";
  const detail = ["PGRST205", "42P01"].includes(code) ? `Required table public.${table} is missing.`
    : ["PGRST204", "42703"].includes(code) ? `Required columns are missing from public.${table}.`
    : code === "42501" ? `Database permissions or RLS prevent access to public.${table}.`
    : `Could not read public.${table} (${code}).`;
  return `${feature}: ${detail} Run supabase/repair.sql in the Supabase SQL editor, then refresh. If the error persists, run supabase/diagnose.sql and check the reported schema and policies.`;
}
