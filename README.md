This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Admin phone uploads

For a new database where none of the migrations below have been applied, run **`supabase/setup.sql` once** in the Supabase SQL editor instead of running each migration individually. It installs all phone, condition, inventory, order and request tables in one transaction. It requires the existing `public.admin_users` table and your admin membership. Do not run the combined setup on a database where these migrations have already succeeded.

Run `supabase/migrations/202611050001_phone_uploads.sql` once in your project's Supabase SQL editor before using the upload form. It creates the `phone_uploads` table, a private `phone-photos` storage bucket, and policies restricted to users already listed in `public.admin_users`. The existing `admin_users` table must allow an admin to read their own membership.

Next run `supabase/migrations/202611060001_publish_phones.sql` once. This adds store details and allows visitors to read published phones and their photos. Earlier uploads remain unpublished because they have no price or specification options.

Open `/admin`, click **Upload a Phone**, enter the phone model, brand, starting price, colours and storage options, and select up to six JPG, PNG or WebP photos (4 MB total). **Upload and Publish Phone** saves the phone and publishes it alongside the original catalogue on the homepage. Each published phone has its own enquiry page with all uploaded photos and the existing Google login / WhatsApp order flow. Device inspection details start as unverified.

The homepage refreshes the catalogue every 20 seconds while visible and when the window regains focus. A dismissible in-app notification links to newly uploaded phones. Seen phone IDs are stored in the visitor's browser, so returning visitors can discover uploads made while they were away. This does not send background push, email or WhatsApp notifications. Photo URLs expire after one hour and are refreshed with the catalogue.

## Booked phones

Run `supabase/migrations/202611060002_booked_phones.sql` after the other two migrations. In `/admin`, open **Manage Booked Phones** to see uploaded and original phones. After confirming a booking through WhatsApp, click **Mark as Booked** to hide that listing from the public catalogue. **Make Available Again** restores a cancelled booking. This applies to the whole listing, not individual storage or colour variants. Phone records and photos are retained.

Open customer pages update within 20 seconds. Direct product links no longer show the enquiry form once refreshed, and submitting an already-open form checks availability again before opening WhatsApp. Notifications for removed phones are cleared when the catalogue refreshes. The initial catalogue waits for availability to load so booked demo phones cannot briefly reappear. If the catalogue cannot refresh, an error is shown and enquiries require a successful availability check. Booking is manual; opening WhatsApp alone does not reserve a phone.

Run `npm test` for the catalogue and admin permission tests, and `npx tsc --noEmit` for type checking.

## Phone condition reports

Run `supabase/migrations/202611060003_phone_conditions.sql` after the other migrations. Open **Verify Phone Conditions** in the admin dashboard to list phones with unverified inspection fields, including original and uploaded phones. Select a phone, enter actual results for battery health, screen, Face ID/fingerprint, cameras, speakers, microphone, charging port, network, Wi-Fi, Bluetooth and True Tone. **Save Progress** preserves partial reports. **Verify and Publish Conditions** requires a result for every check; untested checks must stay `Not yet verified`. Use `Not applicable` only when a feature does not apply.

Completed reports leave the pending list. Enable **Include completed reports** to edit them again. Faulty parts can be recorded in a completed report: inspection complete means every check has a result, not that every part works. Customers see inspection status on homepage cards and all results on the product page. These update automatically within 20 seconds or when the browser window regains focus. Only administrators can write reports; visitors can read them.

Each homepage card also has **View Phone Conditions**, which expands the full live report directly on the homepage. It shares its report component and saved data with the product page. The admin editor links directly to the customer condition section (`/products/[id]#condition-report`). Saving a report signals other open tabs in the same browser to refresh immediately; other visitors receive changes through the regular 20-second refresh. Unverified fields stay visible until an admin records their actual results.

The original four featured phones remain available for browsing before the new tables are created. A missing uploads or inspection table does not hide the original catalogue. Existing booking exclusions are applied whenever the availability table exists. A failed availability read caused by an outage or permission error still blocks the catalogue, so it cannot accidentally restore booked phones. Saving uploads, inspections or orders still requires the database setup.

## Customer orders, requests and delivery verification

Run `supabase/migrations/202611060004_customer_orders.sql` after the previous migrations. It creates private customer orders and special-request publication links, plus database functions for confirming bookings/deliveries and publishing requested phones. Customers can read only their own orders. Admins can view all orders. Only the customer who owns an order can verify its delivery through the customer action, and only once SILVA has marked it delivered.

Both product enquiries and special phone requests now save an order before opening WhatsApp. The WhatsApp message includes its reference. Login, customer details and catalogue availability are checked on the server. Retry IDs prevent duplicate orders from the same submission. Earlier WhatsApp enquiries cannot be recovered automatically because they were not saved.

In **Customer Orders**, SILVA can **Confirm Booking** or **Mark Delivered**. Confirming a booking or delivery also hides its linked phone listing in the same database transaction. Marking delivered keeps the order active and prompts its customer to **Verify Delivery** in **My Orders** on the homepage. Once the customer confirms receipt, it disappears from both active lists and remains under **Order History**. Order panels refresh every 20 seconds and on window focus. This is an in-app prompt, not a background phone notification.

The customer homepage shows **My Orders** below the featured catalogue. If tracking is unavailable, it displays a customer-friendly status with WhatsApp contact and retry options; it does not show database setup instructions or falsely claim the customer has no orders. Setup diagnostics stay in the admin view.

**Special Requests** shows requested phones until delivery is verified. **Already Available — Upload Phone** records that SILVA has sourced a phone and opens the upload form with the model, colour and storage filled in. SILVA adds photos, brand and price, then publishes. The upload and its request link are saved together. If he closes the form, **Upload Requested Phone** lets him resume later. Publishing does not complete a request; it still follows the delivery verification workflow.

Payment details are displayed by `src/components/payment-details.tsx`. Account number `0000000000` is explicitly a placeholder, with no bank or account holder invented. Customers are told not to pay until SILVA provides confirmed details. Replace that component's values once the real account details are supplied.

## Swap deals

The homepage **Swap Deal** option opens `/swap`. Customers enter their current phone, its condition, their preferred replacement, optional contact details, and whether to chat on WhatsApp or arrange a shop meeting. The form opens SILVA's WhatsApp with the request prepared; the customer still presses Send. Swap enquiries go directly to WhatsApp and are not saved as purchase orders or automatically approved.

## Registered customer count

The admin overview displays only the number of accounts registered in Supabase Authentication. It reads the Auth Admin API on the server and refreshes every 20 seconds, on window focus and when the tab becomes visible. Existing and future accounts are counted directly; no customer profile table, SQL migration, signup trigger or customer list is needed for this feature.

Add `SUPABASE_SECRET_KEY` to `.env.local` for local development and to the deployment's private server environment for production. Obtain the project's secret key in Supabase's project API key settings. `SUPABASE_SERVICE_ROLE_KEY` is also accepted for projects using legacy keys. The public publishable key cannot read all Auth accounts. Never prefix the private key with `NEXT_PUBLIC_`. Restart the development server after adding it. See `.env.example` for variable names.

The server verifies the signed-in user and their existing `admin_users` membership before reading Auth. It returns only the total, never account records or the secret key. All Auth accounts are included, including administrators who have accounts. When the private key is missing or invalid, the card shows an unavailable state rather than a false zero. The earlier `202611060005_registered_customers.sql` migration is optional legacy functionality and is not used by the counter.
