# Admin order notification badges

Customer Orders and Special Requests show separate badges in Store Overview, Store Management and the corresponding section headings. Badges count unread pending records from `customer_orders`, separated by `kind`. Existing pending records initially count as unread.

Counts refresh every 20 seconds while the dashboard is visible, on returning to the tab, and after order changes. Viewing a section through its management link marks the currently loaded notifications in that category as read. Administrators scrolling directly to a section can use **Mark notifications as read**. This does not change order status or delete records.

Read state is stored per administrator in that browser and shared between its tabs. Another browser or device has independent read state. Failed database reads display “Notifications unavailable” instead of an inaccurate zero. No new SQL, notification table or secret key is required; the existing order schema and administrator membership must already be configured.

To test locally:

1. Start `npm run dev`; open the dashboard as an administrator.
2. In another browser, sign in as a customer and submit a product order. Within 20 seconds the Customer Orders badge increases.
3. Submit a special phone request. Only the Special Requests badge increases.
4. Click **View Orders**. Its badge clears; the request badge remains and the order is still stored.
5. Refresh the dashboard: previously read records stay read. Create another order to confirm the badge reappears.
6. Ordinary customers cannot call the notification action successfully; it checks both authentication and `admin_users` before querying order metadata.

Deploy this code once to enable badges on Netlify. Subsequent customer orders update them automatically.
