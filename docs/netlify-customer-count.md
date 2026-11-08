# Registered customer count on Netlify

The counter calls Supabase Auth's Admin `listUsers` API, after verifying the signed-in user against `public.admin_users`. No new tables or Google OAuth changes are required. It counts all registered Auth accounts, including administrators.

## Correct the environment

1. Open the Supabase project used by `NEXT_PUBLIC_SUPABASE_URL` and go to **Settings → API Keys → Publishable and secret API keys**.
2. Copy its **secret** key (`sb_secret_…`), not its publishable key (`sb_publishable_…`). A legacy `service_role` JWT is also accepted through `SUPABASE_SERVICE_ROLE_KEY`.
3. In Netlify, select this site, then **Project configuration → Environment variables**. Set `SUPABASE_SECRET_KEY` to that secret value, without quotes or a `Bearer` prefix.
4. Apply it to **Production**, with **Functions** scope (or **All scopes**). Build-only variables are insufficient for the Next.js server action. If testing Deploy Previews, configure that context separately.
5. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` belong to the same project. Those public variables need the build environment; the server also uses them for session validation.
6. Save the variables, then redeploy the site. Netlify environment changes do not modify an already deployed function. Do not put the secret in `netlify.toml`, GitHub, or any `NEXT_PUBLIC_` variable.
7. Sign in as a user listed in `admin_users`. Compare **Registered Customers** with the same project's Supabase **Authentication → Users** list. The card refreshes every 20 seconds and when the tab regains focus.

For local development, put the real secret in the ignored `.env.local` file and restart `npm run dev`. Local `.env.local` values are not automatically copied to Netlify. Never paste a secret into chat, a screenshot, build logs, or a public issue. If a secret was ever exposed, rotate it in Supabase and update Netlify.

## Failure messages

- `KEY_MISSING`: Netlify did not supply a private key to the Functions runtime. Check scope and Production context; redeploy.
- `PUBLIC_KEY` / `KEY_ROLE`: a publishable or anon key was placed in the private-key variable. Replace it with a secret/service-role key.
- `KEY_INVALID`: placeholder, quoted value, Bearer prefix, or unsupported key format.
- `PROJECT_MISMATCH`: a legacy key belongs to a different project URL.
- `KEY_REJECTED`: Supabase returned 401/403. Check whether the key was revoked or belongs to a different project.
- `AUTH_UNAVAILABLE` / `UNAVAILABLE`: a transport error, timeout or API failure. Retry after service recovers.

The card displays `—` until a valid count is received. Failed refreshes retain and label the last successful count; they do not replace it with zero. Raw SDK errors, user records and keys are never returned to the browser or logged by the counter. The private helper is guarded by `server-only`, disables session persistence and caching, and bounds requests with a timeout.

The SDK's pagination total is used when valid. If pagination headers are absent (some SDK responses default the total to zero), the server counts all actual user pages. Failure on any page returns an error rather than a partial count.

References: [Supabase Admin listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Netlify Functions environment variables](https://docs.netlify.com/build/functions/environment-variables/).
