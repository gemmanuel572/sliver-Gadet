# Phone conditions and customer management

## Why Phone Conditions showed a database setup error

The previous editor required `phone_uploads` and `phone_condition_reports`, returned hardcoded phones as an error fallback, and assumed every report had the same 11 fields. It also listed unpublished uploads and ignored booking/removal state. A read-only schema check of the Supabase project configured in this workspace returned `PGRST205` for `phone_uploads`, `phone_availability` and `phone_condition_reports`. The database schema has not been installed in that project or is absent from the Data API schema cache; it is not fixed by a working Supabase Auth counter.

Existing SQL files already define the base tables and RLS. The new per-phone field editor additionally requires:

- `phone_condition_reports.field_labels jsonb`: labels/renames keyed by the stable field ID.
- `phone_condition_reports.removed_fields text[]`: per-phone field removals, preserving existing stored results.
- `manage_phone_inspection_field(text,text,text,text,text)`: an authenticated-admin-only, invoker-security function that locks the report row and updates only one field. It rejects non-catalogue, unpublished, booked and removed phones.

No inspection result or table is deleted by the schema update. RLS remains enabled. The existing report policies allow visitors to read reports and only administrators to write them.

## Exact SQL to run

1. Verify the Supabase project matches Netlify's `NEXT_PUBLIC_SUPABASE_URL`.
2. In **Supabase SQL Editor → New query**, paste all of `supabase/diagnose.sql` and run it. It retrieves schema/policy metadata, not customer records.
3. If the base phone/order schema is missing, paste the entire current **`supabase/repair.sql`** into a new query and run it. The current file includes the dynamic inspection field upgrade. `supabase/setup.sql` is the same repeatable script.
4. If the base repair was already installed, you can instead run only **`supabase/migrations/202611060007_dynamic_inspection_fields.sql`**. It adds the two metadata columns and the one-field update function. Do not run historical migrations again individually.
5. Re-run diagnosis, refresh the admin page, and deploy the source changes after approval.

No SQL is required for the customer directory. It uses the same working server-side Supabase secret/service-role key as the account counter; Google authentication is unchanged. No new customer profile table or signup trigger is used.

## Phone conditions workflow

- **Admin → Manage Phone Conditions** lists the published catalogue that the customer homepage queries. Both original catalogue phones and uploaded products are supported. Draft, removed and booked listings are excluded. Unfulfilled special requests are never products until uploaded and published.
- New published phones appear when the list refreshes (every 20 seconds while open, on focus, on upload/inventory events, or with Reload Published Phones).
- Select a phone and edit its result or label. **Save Field** publishes only that field. Other drafts and uninspected fields are not marked verified. Blank results are stored as `Not yet verified`.
- **Clear Result** resets that field to `Not yet verified`. **Remove Field** hides that field for this phone only and preserves its stored value. Add a standard label again to restore a removed standard field; add a custom label for another inspection item.
- **Add and Save Field** creates an independent field for this phone. Label edits do not modify a global template. There are at most 40 active fields per phone, labels up to 80 characters and results up to 160 characters.
- True Tone is omitted from non-Apple phones, including legacy Samsung reports that stored `Not applicable`. Apple defaults keep the field unless an admin removes it from that particular report.
- Homepage cards and product details render the saved active fields and labels from Supabase. Same-browser tabs receive a refresh signal after saves; other visitors refresh automatically within 20 seconds. Edits require no GitHub push or Netlify redeploy after the schema and feature code are installed.

## Customer directory workflow and privacy

Click **Registered Customers → Manage Customers** to open `/admin/customers`. The working total remains on the dashboard. The directory shows name (Google `full_name`/`name` where provided), email, registration date and provider. Missing names read `Name not provided`.

Normal browsing uses the Auth Admin `listUsers` API with 25 accounts per page. Search scans Auth API pages of 1,000 on the server so name/email matches beyond the first page are included, then returns only one page of matches and exact totals. Large global searches may take longer; failed scans return an error rather than incomplete results. The list automatically refreshes every 20 seconds and on window focus, and offers a manual Refresh Customers button.

Click a customer to open `/admin/customers/[id]`. Account details come from Auth Admin `getUserById`. Saved orders/requests are queried separately with `customer_id = selected_customer_id` and paginated 20 at a time. Only order summaries are returned, not unnecessary addresses or raw order details. If the order table is missing, the account remains visible with a history-unavailable message; no history is fabricated.

The route layout checks the signed-in user and their existing `admin_users` row. Every directory/detail/count server action repeats that authorization before using private Auth APIs. Ordinary users get Access Denied and cannot retrieve records by directly invoking the actions. Only explicit account-summary fields reach the browser; raw metadata, identities, tokens and private API keys do not. Server helpers are guarded by `server-only`. The secret remains in ignored local/server environment variables.

## Local verification

1. Apply the SQL above in a development Supabase project and use that project's existing admin membership. Configure the public URL/publishable key and private server key in `.env.local`; do not paste private keys into code or chat.
2. Run `npm install`, then `npm run dev`. Sign in with the existing Google flow as an administrator.
3. Upload/publish a phone. Check that it appears in both the homepage and Phone Conditions. Mark it booked or remove it, refresh, and verify it disappears from both active lists. An unfulfilled special request must not appear as a product.
4. On a published phone, save battery health only. Check the customer report shows the result and other fields remain unverified. Add a Back Glass field, rename its label, clear it, remove it, and confirm each operation is reflected on the public page within 20 seconds. Inspect Samsung and Apple reports to check True Tone applicability and per-phone removal.
5. Click Registered Customers. Search by a Google name and an email, use pagination, and refresh after signing up another test account. Compare the total to Supabase Authentication → Users.
6. Open a customer with saved orders and requests. Check that only their history appears. Customers without saved records should have an honest empty state; missing order tables should give a history-unavailable message.
7. Sign in as a non-admin test customer. Direct navigation to `/admin/customers` and a customer detail URL must show Access Denied; private server actions must also reject access. Sign out and verify the route sends you to login.
8. Run `npm test` and `npm run lint`. Production verification in this environment uses `npm run build -- --webpack` because Turbopack's worker-port binding is restricted. The deployment build script is unchanged.

Tests cover active catalogue/report alignment, per-phone custom field rendering, field-by-field SQL updates, removal and data preservation, RLS, directory authorization, pagination beyond 1,000 accounts, sanitized responses, missing order history and the working counter.
