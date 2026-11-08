# Inventory, orders and special requests: database repair

The Registered Customers card uses Supabase Auth's Admin API. The other sections use ordinary database tables through the customer's/admin's authenticated Supabase session. A working Auth count does not create those tables or grant database access.

A read-only check against the project configured in `.env.local` returned `PGRST205` for all five app tables below. This means they are missing from the Data API schema (the SQL diagnosis distinguishes absent physical tables from schema-cache or permission problems). Netlify's private environment and live administrator session are not available from this workspace; verify that Netlify points to the same Supabase project.

## What the code needs

| Feature | Tables, columns and operations |
| --- | --- |
| Inventory list | `phone_uploads`: `id,name,brand,price,description,colors,storage,is_published,created_at`; `phone_availability`: `product_id,booked,is_removed,overrides` |
| Phone uploads | `phone_uploads` also needs `photo_paths,uploaded_by`; private Storage bucket `phone-photos` with image insert/select/delete policies |
| Inventory edits/removal/bookings | Admin-only upsert of `phone_availability`; `overrides` stores name, brand, price, description, colours and storage; `is_removed` is reversible removal |
| Inspection reports | `phone_condition_reports`: `product_id,conditions` |
| Orders and special requests | Both use `customer_orders`: `id,request_id,customer_id,customer_email,product_id,kind,phone_name,listed_price,details,status,created_at`. Requests are rows with `kind='request'`; they are not a separate orders table |
| Sourcing special requests | `request_publications`: `order_id,product_id`; functions `publish_requested_phone(uuid,jsonb)` and `advance_customer_order(uuid,text)` |
| Admin authorization | Existing `admin_users(user_id)` must contain the signed-in user's Auth UUID and allow that user to read their membership |

The old list messages hid which dependency failed. Admin errors now identify a missing table, missing column or permission error. Shopper pages keep customer-friendly errors.

## Apply the exact SQL

1. Confirm the Supabase project's URL matches Netlify's `NEXT_PUBLIC_SUPABASE_URL`.
2. In Supabase **SQL Editor → New query**, paste and run all of `supabase/diagnose.sql`. It reports tables, columns, RLS flags, grants, policies and required functions without reading customer data.
3. Paste the entire contents of **`supabase/repair.sql`** into another query and run it. The base repair is versioned as `supabase/migrations/202611060006_inventory_order_repair.sql`; the current repair also includes `202611060007_dynamic_inspection_fields.sql`. When using individual migrations, apply 006 then 007. Rerunning the combined repair is supported if necessary.
4. Run `diagnose.sql` again. Required columns/functions should be present and RLS enabled.
5. Refresh the admin dashboard. Deploy the source changes after approving the GitHub push to enable the new edit/remove controls. Apply SQL before deploying this code, because the controls require the added `is_removed` and `overrides` columns.

The old `setup.sql` and migrations already describe most of this schema, but earlier files are not individually safe to rerun after a partial installation. `setup.sql` now uses the same repeatable repair. The working customer counter, its server key and Google login are not changed or used for inventory access. No extra customer registry table is needed.

## Data preservation and permissions

- Creates missing tables and adds missing columns with `IF NOT EXISTS`. Existing rows, photos, orders and admin memberships remain. Functions and app-owned policies are replaced without recreating tables.
- Keeps RLS enabled. Authenticated admins can manage inventory and view all orders/requests. Customers can insert their own pending orders, read only their own records and verify only their own delivered orders. Anonymous users cannot read orders or request links.
- Restrictive policy boundaries protect orders and management operations even when an older permissive policy grants broader access. Unrelated policies and other storage buckets are preserved.
- Table and column grants restrict customer order updates to `status`; an additional trigger prevents a customer from changing ownership or order details. Admin status transitions and booking the linked listing happen in one transaction.
- Existing `admin_users` rows are retained. Members can still read their own membership for dashboard/counter authorization, but web clients cannot insert, update or delete memberships to assign themselves admin access. Admin membership remains managed by the database owner.
- The private `phone-photos` bucket is restored to private access. Its policies allow public reads only for active published listings, admin uploads and admin cleanup of their own uploads.
- Removing a phone sets `is_removed=true`; restoring clears it. Existing booking state and edit data stay intact. Both original hardcoded catalogue phones and uploaded phones can be edited or removed. Public cards and order validation read the same state. No hard delete is exposed.
- Unique indexes never deduplicate or delete rows. If an existing database has duplicate identifiers or incompatible column types, the repair transaction stops rather than altering that business data. Use diagnosis output to correct those specific records/types deliberately. Missing old ownership or phone details are not fabricated; legacy incomplete rows may need manual backfilling before publication.

## Verification

`npm test` runs an embedded PostgreSQL test (PGlite, development-only dependency) that applies the actual repair twice, preserves existing records, checks restrictive RLS against a legacy broad policy, verifies admin inventory operations, tests customer isolation and confirms delivery ownership. Additional tests cover inventory overrides, booking/removal, server authorization, the customer counter and orders.

Production verification in this environment uses `npm run build -- --webpack`; Turbopack's CSS worker port is blocked here. The existing deployment build script is unchanged.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL restrictive policies](https://www.postgresql.org/docs/current/sql-createpolicy.html).
