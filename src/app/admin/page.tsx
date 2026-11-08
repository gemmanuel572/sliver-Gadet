import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhoneInventory from "./components/phone-inventory";
import PhoneUpload from "./components/phone-upload";
import PhoneConditionManager from "./components/phone-conditions";
import OrdersPanel from "@/components/orders-panel";
import RegisteredCustomers from "./components/registered-customers";
import { OrderNotificationsProvider, OrderNotificationBadge, OrderNotificationLink } from "./components/order-notifications";

async function AdminDashboardContent() {
  const supabase = await createClient();

  // STEP 1: CHECK IF THE USER IS SIGNED IN
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // IF NOT SIGNED IN, REDIRECT TO LOGIN
  if (!user || authError) {
    redirect("/login?next=%2Fadmin");
  }

  // STEP 2: CHECK IF THE USER IS AN ADMIN
  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // HANDLE DATABASE ERRORS
  if (adminError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080b12] px-6 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400">
            Unable to Verify Admin Access
          </h1>

          <p className="mt-4 text-gray-400">
            Something went wrong while checking your
            administrator permissions.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block text-blue-400 hover:underline"
          >
            Return to Store
          </Link>
        </div>
      </main>
    );
  }

  // BLOCK USERS WHO ARE NOT ADMINS
  if (!admin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#080b12] px-6 text-white">
        <h1 className="text-3xl font-black text-red-400">
          Access Denied
        </h1>

        <p className="mt-4 text-center text-gray-400">
          You are not authorized to access the
          SILVA Admin Dashboard.
        </p>

        <Link
          href="/"
          className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
        >
          Return to Store
        </Link>
      </main>
    );
  }

  // STEP 3: DISPLAY ADMIN DASHBOARD
  return (
    <OrderNotificationsProvider adminId={user.id}>
    <main className="min-h-screen bg-[#080b12] text-white">
      {/* ADMIN HEADER */}
      <header className="border-b border-white/10 bg-[#111827] px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl font-black">
              SILVA{" "}
              <span className="text-blue-500">
                ADMIN
              </span>
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              Store Management Dashboard
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-700"
          >
            View Store
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* WELCOME MESSAGE */}
        <section>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
            SILVA CELEBRITY DEALER
          </p>

          <h2 className="mt-3 text-3xl font-black md:text-4xl">
            Welcome, Administrator
          </h2>

          <p className="mt-4 text-gray-400">
            Manage your products, customers, orders
            and inventory from one dashboard.
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Signed in as: {user.email}
          </p>
        </section>

        {/* DASHBOARD STATISTICS */}
        <section className="mt-12">
          <h2 className="text-2xl font-black">
            Store Overview
          </h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* PRODUCTS */}
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
              <p className="text-sm text-gray-400">
                Listed Products
              </p>

              <p className="mt-4 text-4xl font-black text-blue-400">
                <Link href="#phone-inventory" className="text-lg underline">View Inventory</Link>
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Available and booked phones
              </p>
            </div>

            {/* ORDERS */}
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
              <p className="text-sm text-gray-400">
                Customer Orders <OrderNotificationBadge kind="product" />
              </p>

              <p className="mt-4 text-lg font-bold">
                <OrderNotificationLink kind="product" className="text-blue-400 underline">View Orders</OrderNotificationLink>
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Bookings and delivery verification
              </p>
            </div>

            {/* SPECIAL REQUESTS */}
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
              <p className="text-sm text-gray-400">
                Special Requests <OrderNotificationBadge kind="request" />
              </p>

              <p className="mt-4 text-lg font-bold">
                <OrderNotificationLink kind="request" className="text-blue-400 underline">View Requests</OrderNotificationLink>
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Source and upload requested phones
              </p>
            </div>

            {/* CUSTOMERS */}
            <RegisteredCustomers />
          </div>
        </section>

        {/* ADMIN MANAGEMENT FEATURES */}
        <section className="mt-16">
          <h2 className="text-2xl font-black">
            Store Management
          </h2>

          <p className="mt-3 text-gray-400">
            Upload phones, remove phones from the customer homepage, and manage your store below.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <PhoneUpload />
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-7">
              <div className="mb-5 text-3xl">📦</div>
              <h3 className="text-xl font-bold">Manage Homepage Phones</h3>
              <p className="mt-3 text-sm leading-7 text-gray-400">Manage phones already displayed on the customer homepage, including original phones and uploaded phones. Choose Remove Phone to hide a listing, or restore it later.</p>
              <Link href="#phone-inventory" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700">Remove or Restore Phones</Link>
            </div>
            <PhoneConditionManager />
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-7">
              <div className="mb-5 text-3xl">🛒</div><h3 className="text-xl font-bold">Customer Orders <OrderNotificationBadge kind="product" /></h3>
              <p className="mt-3 text-sm leading-7 text-gray-400">See customer orders, confirm bookings and mark deliveries for customer verification.</p>
              <OrderNotificationLink kind="product" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold">Manage Orders</OrderNotificationLink>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-7">
              <div className="mb-5 text-3xl">📋</div><h3 className="text-xl font-bold">Special Requests <OrderNotificationBadge kind="request" /></h3>
              <p className="mt-3 text-sm leading-7 text-gray-400">Keep requested phones here until you source and deliver them. Upload a phone when it becomes available.</p>
              <OrderNotificationLink kind="request" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold">Manage Special Requests</OrderNotificationLink>
            </div>
            {[
              {
                title: "Payment Verification",
                description:
                  "Manually confirm customer bank transfers before processing orders.",
                icon: "💳",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-[#111827] p-7 transition hover:border-blue-500/40"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/10 text-3xl">
                  {feature.icon}
                </div>

                <h3 className="text-xl font-bold">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-gray-400">
                  {feature.description}
                </p>

                <p className="mt-6 text-sm font-semibold text-blue-400">
                  Coming soon
                </p>
              </div>
            ))}
          </div>
        </section>

        <PhoneInventory />
        <OrdersPanel admin />
        <OrdersPanel admin requestsOnly />
      </div>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        © 2026 SILVA CELEBRITY DEALER.
        Admin Dashboard.
      </footer>
    </main>
    </OrderNotificationsProvider>
  );
}

export default function AdminDashboard() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#080b12] text-white">Loading administrator access…</main>}>
    <AdminDashboardContent />
  </Suspense>;
}
