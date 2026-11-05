"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { products } from "@/data/products";

const productBadges: Record<string, string> = {
  "iphone-15-pro-max": "BEST SELLER",
  "iphone-14-pro": "POPULAR",
  "samsung-s24-ultra": "PREMIUM",
  "iphone-13": "GREAT VALUE",
};

const heroImage =
  "https://static01.galaxus.com/productimages/4/9/9/6/7/0/2/9/6/2/5/8/8/2/3/0/7/7/a3ca2b7a-b182-49e1-80e3-eda7d00c55c0.jpg_sea.jpeg";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.brand} ${product.storage.join(" ")}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim())
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    document.getElementById("products")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      {/* NAVIGATION */}
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5">
          <Link href="/" className="text-xl font-black tracking-tight">
            SILVA<span className="text-blue-500">.</span>
          </Link>

          <div className="hidden gap-6 text-sm text-gray-300 md:flex">
            <Link href="/" className="hover:text-blue-400">
              Home
            </Link>

            <Link href="#products" className="hover:text-blue-400">
              Products
            </Link>

            <Link href="#about" className="hover:text-blue-400">
              About Us
            </Link>

            <Link href="#contact" className="hover:text-blue-400">
              Contact
            </Link>
          </div>

          {/* SEARCH BAR */}
          <form
            onSubmit={handleSearch}
            className="flex w-full gap-2 md:w-auto md:max-w-md md:flex-1"
          >
            <input
              type="search"
              placeholder="Search for a phone..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#111827] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500"
            />

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          <a
            href="https://wa.me/2348137596850"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-700"
          >
            Contact Us
          </a>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-2">
        <div>
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
            Your trusted gadget plug
          </p>

          <h1 className="text-5xl font-black leading-tight md:text-7xl">
            Premium Gadgets.
            <span className="text-blue-500"> Better Deals.</span>
          </h1>

          <p className="mt-7 max-w-lg leading-8 text-gray-400">
            Discover quality smartphones and gadgets at competitive prices.
            Get the device you want with a buying experience you can trust.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="#products"
              className="rounded-xl bg-blue-600 px-7 py-4 font-bold hover:bg-blue-700"
            >
              Explore Products →
            </Link>

            <a
              href="https://wa.me/2348137596850"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/20 px-7 py-4 font-bold hover:bg-white/10"
            >
              Talk to Us
            </a>
          </div>

          <div className="mt-12 flex flex-wrap gap-10">
            <div>
              <p className="text-2xl font-black">Quality</p>
              <p className="mt-1 text-sm text-gray-500">Gadgets</p>
            </div>

            <div>
              <p className="text-2xl font-black">Great</p>
              <p className="mt-1 text-sm text-gray-500">Prices</p>
            </div>

            <div>
              <p className="text-2xl font-black">Reliable</p>
              <p className="mt-1 text-sm text-gray-500">Service</p>
            </div>
          </div>
        </div>

        {/* IPHONE 15 PRO MAX HERO IMAGE */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-600/20 blur-[100px]" />

          <div className="relative flex min-h-[450px] items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-[#151f32] to-[#080b12] p-6">
            <img
              src={heroImage}
              alt="Apple iPhone 15 Pro Max"
              className="h-[400px] w-full max-w-lg rounded-2xl object-contain"
            />
          </div>
        </div>
      </section>

      {/* PRODUCTS SECTION */}
      <section id="products" className="bg-[#0d121d] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-400">
                Our collection
              </p>

              <h2 className="text-4xl font-black">
                Featured Gadgets
              </h2>

              <p className="mt-3 text-gray-400">
                Explore some of our featured devices.
              </p>
            </div>

            <span className="text-sm text-gray-500">
              Quality meets affordability.
            </span>
          </div>

          {/* AVAILABLE PHONES */}
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#111827] transition hover:-translate-y-2 hover:border-blue-500/50"
              >
                <Link href={`/products/${product.id}`}>
                  <div className="relative h-64 bg-white">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-contain p-5"
                    />

                    <span className="absolute left-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold">
                      {productBadges[product.id] || "AVAILABLE"}
                    </span>
                  </div>
                </Link>

                <div className="p-5">
                  <p className="text-xs font-semibold tracking-wider text-blue-400">
                    {product.brand.toUpperCase()} ·{" "}
                    {product.storage[0] || "SMARTPHONE"}
                  </p>

                  <h3 className="mt-3 text-lg font-bold">
                    {product.name}
                  </h3>

                  <p className="mt-3 text-xl font-black">
                    ₦{product.price.toLocaleString("en-NG")}
                  </p>

                  <Link
                    href={`/products/${product.id}`}
                    className="mt-5 block rounded-xl border border-white/10 py-3 text-center text-sm font-semibold transition hover:bg-blue-600"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* PHONE NOT AVAILABLE — REQUEST FEATURE */}
          {filteredProducts.length === 0 &&
            searchQuery.trim() !== "" && (
              <div className="rounded-2xl border border-blue-500/30 bg-[#111827] px-6 py-12 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-600/10 text-5xl">
                  📱
                </div>

                <p className="mt-6 text-sm font-bold uppercase tracking-widest text-blue-400">
                  Special Phone Request
                </p>

                <h3 className="mt-4 break-words text-3xl font-black">
                  {searchQuery.trim()}
                </h3>

                <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-gray-300">
                  This phone is not available right now, but you
                  can book it and wait for SILVA to get it for you.
                </p>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-gray-500">
                  You can tell us your preferred colour, storage
                  capacity, phone condition and quantity.
                  SILVA will confirm availability, price and
                  delivery time.
                </p>

                <Link
                  href={`/request?phone=${encodeURIComponent(
                    searchQuery.trim()
                  )}`}
                  className="mt-8 inline-block rounded-xl bg-blue-600 px-8 py-4 font-bold transition hover:bg-blue-700"
                >
                  Request This Phone →
                </Link>

                <div>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-6 text-sm text-blue-400 hover:underline"
                  >
                    Show Available Phones
                  </button>
                </div>
              </div>
            )}
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-400">
            Who we are
          </p>

          <h2 className="text-4xl font-black">
            Your Gadget Plug. Your Trusted Dealer.
          </h2>

          <p className="mt-6 leading-8 text-gray-400">
            At SILVA CELEBRITY DEALER, we believe buying a gadget
            should be simple and straightforward. We connect
            customers with smartphones and other gadgets while
            providing a convenient way to make enquiries
            and place orders.
          </p>
        </div>
      </section>

      {/* DEALER PROFILE */}
      <section className="bg-[#0d121d] px-6 py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 md:flex-row">
          <div className="w-full md:w-1/2">
            <img
              src="/silva-profile.jpg"
              alt="Silva Celebrity Dealer"
              className="h-[450px] w-full rounded-2xl object-cover"
            />
          </div>

          <div className="w-full text-center md:w-1/2 md:text-left">
            <p className="mb-4 font-bold uppercase tracking-[0.3em] text-blue-400">
              Meet Your Gadget Plug
            </p>

            <h2 className="text-5xl font-black uppercase leading-tight md:text-7xl">
              SILVA
              <span className="block text-blue-500">
                CELEBRITY
              </span>
              DEALER
            </h2>

            <p className="mt-6 leading-8 text-gray-400">
              Your trusted destination for quality gadgets
              and premium smartphones.
            </p>

            <a
              href="https://wa.me/2348137596850"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block rounded-xl bg-blue-600 px-7 py-4 font-bold hover:bg-blue-700"
            >
              Contact Silva →
            </a>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section
        id="contact"
        className="bg-blue-600 px-6 py-20 text-center"
      >
        <h2 className="text-4xl font-black">
          Ready to Get Your Next Gadget?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-blue-100">
          Have questions about a device?
          Contact us directly.
        </p>

        <a
          href="https://wa.me/2348137596850"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block rounded-xl bg-white px-8 py-4 font-bold text-blue-700 hover:bg-gray-100"
        >
          Chat With Us on WhatsApp
        </a>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 text-sm text-gray-500">
          <p>
            © 2026 SILVA CELEBRITY DEALER.
            All rights reserved.
          </p>

          <p>Otukpo, Benue State, Nigeria</p>

          <p>WhatsApp: 08137596850</p>
        </div>
      </footer>
    </main>
  );
}