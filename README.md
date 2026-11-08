This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Admin phone uploads

For missing Inventory, Customer Orders or Special Requests tables/policies, use the repeatable [database repair guide](docs/inventory-order-database.md) and `supabase/repair.sql`. It preserves existing data, enables the required RLS policies and adds inventory edit/removal state. `supabase/diagnose.sql` reports the current schema without reading customer records.

**`supabase/setup.sql` now matches the repeatable `supabase/repair.sql`.** Run either entire file in the Supabase SQL editor to install or repair the phone, condition, inventory, order and request schema in one transaction. It requires the existing `public.admin_users` table and your admin membership. The original migrations below are retained for history and are already included in the repair; they do not need to be run separately.

The original `supabase/migrations/202611050001_phone_uploads.sql` defines the `phone_uploads` table, a private `phone-photos` storage bucket, and policies restricted to users already listed in `public.admin_users`. The existing `admin_users` table must allow an admin to read their own membership.

The original `supabase/migrations/202611060001_publish_phones.sql` adds store details and allows visitors to read published phones and their photos. Earlier uploads remain unpublished because they have no price or specification options.

Open `/admin`, click **Upload a Phone**, enter the phone model, brand, starting price, colours and storage options, and select up to six JPG, PNG or WebP photos (4 MB total). **Upload and Publish Phone** saves the phone and publishes it alongside the original catalogue on the homepage. Each published phone has its own enquiry page with all uploaded photos and the existing Google login / WhatsApp order flow. Device inspection details start as unverified.

The homepage refreshes the catalogue every 20 seconds while visible and when the window regains focus. A dismissible in-app notification links to newly uploaded phones. Seen phone IDs are stored in the visitor's browser, so returning visitors can discover uploads made while they were away. This does not send background push, email or WhatsApp notifications. Photo URLs expire after one hour and are refreshed with the catalogue.

## Booked phones

The booking schema is included in the repair (original migration: `202611060002_booked_phones.sql`). In `/admin`, open **Manage Booked Phones** to see uploaded and original phones. After confirming a booking through WhatsApp, click **Mark as Booked** to hide that listing from the public catalogue. **Make Available Again** restores a cancelled booking. This applies to the whole listing, not individual storage or colour variants. Phone records and photos are retained.

Open customer pages update within 20 seconds. Direct product links no longer show the enquiry form once refreshed, and submitting an already-open form checks availability again before opening WhatsApp. Notifications for removed phones are cleared when the catalogue refreshes. The initial catalogue waits for availability to load so booked demo phones cannot briefly reappear. If the catalogue cannot refresh, an error is shown and enquiries require a successful availability check. Booking is manual; opening WhatsApp alone does not reserve a phone.

Run `npm test` for the catalogue and admin permission tests, and `npx tsc --noEmit` for type checking.

## Phone condition reports

Follow [Phone conditions and customer management](docs/phone-conditions-and-customers.md) for setup, workflows and local verification. The current repair/setup includes per-phone labels and field-removal metadata. Existing repaired databases can run `supabase/migrations/202611060007_dynamic_inspection_fields.sql` alone.

**Admin → Manage Phone Conditions** lists only published, available homepage products. Select a phone to save or rename an individual inspection field, clear its result back to `Not yet verified`, remove it from that phone, or add a custom field. Unsaved/uninspected fields stay unverified. True Tone is omitted from non-Apple phones. New uploaded/published products appear automatically; removed, booked and unpublished phones do not appear.

Homepage cards and product details render the saved field values and labels from Supabase. Saves signal other open tabs to refresh, and other visitors see changes within 20 seconds. No code edit or redeployment is needed for inspection changes after initial feature/schema setup.

## Customer orders, requests and delivery verification

The order schema and request functions are included in the repair (original migration: `202611060004_customer_orders.sql`). It creates private customer orders and special-request publication links, plus database functions for confirming bookings/deliveries and publishing requested phones. Customers can read only their own orders. Admins can view all orders. Only the customer who owns an order can verify its delivery through the customer action, and only once SILVA has marked it delivered.

Both product enquiries and special phone requests now save an order before opening WhatsApp. The WhatsApp message includes its reference. Login, customer details and catalogue availability are checked on the server. Retry IDs prevent duplicate orders from the same submission. Earlier WhatsApp enquiries cannot be recovered automatically because they were not saved.

In **Customer Orders**, SILVA can **Confirm Booking** or **Mark Delivered**. Confirming a booking or delivery also hides its linked phone listing in the same database transaction. Marking delivered keeps the order active and prompts its customer to **Verify Delivery** in **My Orders** on the homepage. Once the customer confirms receipt, it disappears from both active lists and remains under **Order History**. Order panels refresh every 20 seconds and on window focus. This is an in-app prompt, not a background phone notification.

The customer homepage shows **My Orders** below the featured catalogue. If tracking is unavailable, it displays a customer-friendly status with WhatsApp contact and retry options; it does not show database setup instructions or falsely claim the customer has no orders. Setup diagnostics stay in the admin view.

**Special Requests** shows requested phones until delivery is verified. **Already Available — Upload Phone** records that SILVA has sourced a phone and opens the upload form with the model, colour and storage filled in. SILVA adds photos, brand and price, then publishes. The upload and its request link are saved together. If he closes the form, **Upload Requested Phone** lets him resume later. Publishing does not complete a request; it still follows the delivery verification workflow.

Payment details are displayed by `src/components/payment-details.tsx`. Account number `0000000000` is explicitly a placeholder, with no bank or account holder invented. Customers are told not to pay until SILVA provides confirmed details. Replace that component's values once the real account details are supplied.

## Swap deals

The homepage **Swap Deal** option opens `/swap`. Customers enter their current phone, its condition, their preferred replacement, optional contact details, and whether to chat on WhatsApp or arrange a shop meeting. The form opens SILVA's WhatsApp with the request prepared; the customer still presses Send. Swap enquiries go directly to WhatsApp and are not saved as purchase orders or automatically approved.

## Registered customer count

The admin overview displays the number of accounts registered in Supabase Authentication and links to `/admin/customers` for account management. It reads the Auth Admin API on the server and refreshes every 20 seconds, on window focus and when the tab becomes visible. Existing and future accounts are counted and listed directly; no customer profile table, SQL migration or signup trigger is needed for customer management.

Add `SUPABASE_SECRET_KEY` to `.env.local` for local development and to the deployment's private server environment for production. Obtain the project's secret key in Supabase's project API key settings. `SUPABASE_SERVICE_ROLE_KEY` is also accepted for projects using legacy keys. The public publishable key cannot read all Auth accounts. Never prefix the private key with `NEXT_PUBLIC_`. Restart the development server after adding it. See `.env.example` for variable names.

The server verifies the signed-in user and their existing `admin_users` membership before reading Auth. It returns only the total, never account records or the secret key. All Auth accounts are included, including administrators who have accounts. When the private key is missing or invalid, the card shows an unavailable state rather than a false zero. The earlier `202611060005_registered_customers.sql` migration is optional legacy functionality and is not used by the counter.

See [Netlify customer-count setup and troubleshooting](docs/netlify-customer-count.md) for Production context, Functions scope, redeployment and safe key handling. The private key must actually be a secret key; renaming a publishable key to `SUPABASE_SECRET_KEY` does not grant Admin API access.

The directory displays paginated name/email/registration/provider summaries, supports global name/email search and links to per-customer account and saved-order details. Routes and server actions require existing `admin_users` membership. See the [management guide](docs/phone-conditions-and-customers.md) for privacy guarantees and tests.
