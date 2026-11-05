"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type FormEvent } from "react";

// INPUT STYLING
const inputStyle =
  "w-full rounded-xl border border-white/10 bg-[#080b12] px-4 py-4 text-white outline-none focus:border-blue-500";

// VALIDATE NIGERIAN PHONE NUMBERS
function isValidPhone(number: string) {
  return /^0[0-9]{10}$/.test(number);
}

// ALLOW ONLY DIGITS
function handlePhoneInput(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = event.currentTarget.value
    .replace(/\D/g, "")
    .slice(0, 11);
}

// PHONE REQUEST COMPONENT
function PhoneRequestContent() {
  const searchParams = useSearchParams();

  const requestedPhone =
    searchParams.get("phone")?.trim() || "";

  // HANDLE PHONE REQUEST
  function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const getValue = (name: string) =>
      String(form.get(name) || "").trim();

    // PHONE DETAILS
    const phoneModel = getValue("phoneModel");
    const color = getValue("color");
    const storage = getValue("storage");
    const condition = getValue("condition");
    const quantity = getValue("quantity");

    // CUSTOMER DETAILS
    const customerName = getValue("customerName");
    const phone = getValue("phone");
    const alternativeName = getValue("alternativeName");
    const alternativePhone = getValue("alternativePhone");

    // DELIVERY DETAILS
    const address = getValue("address");
    const location = getValue("location");
    const deliveryPreference = getValue("deliveryPreference");

    const note = getValue("note");

    // VALIDATE MAIN PHONE NUMBER
    if (!isValidPhone(phone)) {
      alert(
        "Please enter a valid Nigerian phone number containing exactly 11 digits and starting with 0."
      );
      return;
    }

    // VALIDATE ALTERNATIVE NUMBER
    if (
      alternativePhone &&
      !isValidPhone(alternativePhone)
    ) {
      alert(
        "Please enter a valid 11-digit alternative phone number."
      );
      return;
    }

    // VALIDATE CUSTOMER NAME
    const namePattern = /^[\p{L}\s'.-]+$/u;

    if (!customerName || !namePattern.test(customerName)) {
      alert(
        "Please enter a valid full name using letters, not numbers."
      );
      return;
    }

    if (
      alternativeName &&
      !namePattern.test(alternativeName)
    ) {
      alert(
        "Please enter a valid alternative contact name."
      );
      return;
    }

    // VALIDATE QUANTITY
    const quantityNumber = Number(quantity);

    if (
      !Number.isSafeInteger(quantityNumber) ||
      quantityNumber < 1
    ) {
      alert("Please enter a valid quantity of at least 1.");
      return;
    }

    // CONFIRM CUSTOMER DETAILS
    const confirmed = window.confirm(
      `PLEASE CONFIRM YOUR PHONE REQUEST

PHONE REQUEST
Phone: ${phoneModel}
Colour: ${color}
Storage: ${storage}
Condition: ${condition}
Quantity: ${quantity}

CUSTOMER DETAILS
Name: ${customerName}
Phone: ${phone}
Alternative Contact: ${alternativeName || "Not provided"}
Alternative Number: ${alternativePhone || "Not provided"}

DELIVERY DETAILS
Address: ${address}
Location: ${location}
Delivery Preference: ${deliveryPreference}

Additional Note: ${note || "None"}

Are you sure all your information is correct?

Click OK to continue to WhatsApp.
Click Cancel to make corrections.`
    );

    // STOP IF CUSTOMER CLICKS CANCEL
    if (!confirmed) {
      return;
    }

    // CREATE WHATSAPP MESSAGE
    const message = `
Hello SILVA CELEBRITY DEALER!

I want to request a phone that is not currently listed on your website.

PHONE REQUEST DETAILS

Phone: ${phoneModel}
Preferred Colour: ${color}
Preferred Storage: ${storage}
Preferred Condition: ${condition}
Quantity: ${quantity}

CUSTOMER INFORMATION

Full Name: ${customerName}
Main Phone Number: ${phone}
Alternative Contact Name: ${alternativeName || "Not provided"}
Alternative Phone Number: ${alternativePhone || "Not provided"}

DELIVERY INFORMATION

Delivery Address: ${address}
State / Town / Location: ${location}
Delivery Preference: ${deliveryPreference}

ADDITIONAL INFORMATION

${note || "None"}

Please confirm if you can get this phone for me.

Kindly confirm the price, availability, phone condition and estimated delivery time.

Thank you!
`;

    // OPEN WHATSAPP
    const whatsappURL =
      "https://wa.me/2348137596850?text=" +
      encodeURIComponent(message);

    window.location.href = whatsappURL;
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">

      {/* NAVIGATION */}
      <nav className="border-b border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-2xl font-black">
            SILVA<span className="text-blue-500">.</span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-blue-400"
          >
            ← Back to Store
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-12">

        {/* PHONE REQUEST INFORMATION */}
        <section className="rounded-3xl border border-white/10 bg-[#111827] p-8 text-center">

          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-2xl bg-[#080b12] text-7xl">
            📱
          </div>

          <p className="mt-8 font-bold uppercase tracking-widest text-blue-400">
            Special Phone Request
          </p>

          <h1 className="mt-4 break-words text-3xl font-black md:text-5xl">
            {requestedPhone || "Request Your Preferred Phone"}
          </h1>

          <p className="mx-auto mt-6 max-w-xl leading-8 text-gray-400">
            This phone is not currently listed in our store,
            but you can request it and SILVA will check
            whether he can get it for you.
          </p>

          <div className="mt-8 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">

            <h3 className="font-bold text-yellow-400">
              Availability Not Confirmed
            </h3>

            <p className="mt-3 text-sm leading-7 text-gray-300">
              The phone's availability, price, specifications
              and condition have not yet been confirmed.
            </p>
          </div>

          <a
            href="#request-form"
            className="mt-8 inline-block rounded-xl bg-blue-600 px-8 py-4 font-bold hover:bg-blue-700"
          >
            Complete Your Request →
          </a>

        </section>

        {/* PHONE REQUEST FORM */}
        <section
          id="request-form"
          className="mt-12 rounded-3xl border border-white/10 bg-[#111827] p-6 md:p-10"
        >

          <p className="font-bold uppercase tracking-widest text-blue-400">
            Book Your Preferred Phone
          </p>

          <h2 className="mt-3 text-3xl font-black">
            Complete Your Phone Request
          </h2>

          <p className="mt-4 text-gray-400">
            Tell SILVA which phone you want,
            your preferred specifications and
            how to contact you.
          </p>

          <form
            onSubmit={handleRequest}
            className="mt-10 space-y-7"
          >

            {/* PHONE NAME */}
            <div>
              <label
                htmlFor="phoneModel"
                className="mb-3 block font-semibold"
              >
                Phone Name / Model *
              </label>

              <input
                id="phoneModel"
                name="phoneModel"
                type="text"
                defaultValue={requestedPhone}
                placeholder="e.g. iPhone 16 Pro Max"
                maxLength={120}
                required
                className={inputStyle}
              />
            </div>

            {/* PREFERRED COLOUR */}
            <div>
              <label
                htmlFor="color"
                className="mb-3 block font-semibold"
              >
                Preferred Phone Colour *
              </label>

              <input
                id="color"
                name="color"
                type="text"
                list="colorSuggestions"
                placeholder="e.g. Black, Blue, Silver"
                required
                className={inputStyle}
              />

              <datalist id="colorSuggestions">
                <option value="Black" />
                <option value="White" />
                <option value="Blue" />
                <option value="Silver" />
                <option value="Gold" />
                <option value="Natural Titanium" />
                <option value="Any available colour" />
              </datalist>
            </div>

            {/* STORAGE CAPACITY */}
            <div>
              <label
                htmlFor="storage"
                className="mb-3 block font-semibold"
              >
                Preferred Storage Capacity *
              </label>

              <input
                id="storage"
                name="storage"
                type="text"
                list="storageSuggestions"
                placeholder="e.g. 128GB, 256GB, 512GB"
                required
                className={inputStyle}
              />

              <datalist id="storageSuggestions">
                <option value="64GB" />
                <option value="128GB" />
                <option value="256GB" />
                <option value="512GB" />
                <option value="1TB" />
              </datalist>
            </div>

            {/* PHONE CONDITION */}
            <div>
              <label
                htmlFor="condition"
                className="mb-3 block font-semibold"
              >
                Preferred Phone Condition *
              </label>

              <select
                id="condition"
                name="condition"
                required
                defaultValue=""
                className={inputStyle}
              >
                <option value="" disabled>
                  Choose preferred condition
                </option>

                <option value="Brand New">
                  Brand New
                </option>

                <option value="UK Used">
                  UK Used
                </option>

                <option value="Nigerian Used">
                  Nigerian Used
                </option>

                <option value="Any available condition">
                  Any Available Condition
                </option>
              </select>
            </div>

            {/* QUANTITY */}
            <div>
              <label
                htmlFor="quantity"
                className="mb-3 block font-semibold"
              >
                Quantity *
              </label>

              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                required
                className={inputStyle}
              />
            </div>

            {/* CUSTOMER INFORMATION */}
            <h3 className="border-b border-white/10 pb-4 pt-6 text-2xl font-bold">
              Customer Information
            </h3>

            {/* FULL NAME */}
            <div>
              <label
                htmlFor="customerName"
                className="mb-3 block font-semibold"
              >
                Full Name *
              </label>

              <input
                id="customerName"
                name="customerName"
                type="text"
                placeholder="Enter your full name"
                required
                className={inputStyle}
              />
            </div>

            {/* MAIN PHONE NUMBER */}
            <div>
              <label
                htmlFor="phone"
                className="mb-3 block font-semibold"
              >
                Main Phone Number *
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                placeholder="08012345678"
                pattern="0[0-9]{10}"
                minLength={11}
                maxLength={11}
                title="Enter exactly 11 digits starting with 0"
                onInput={handlePhoneInput}
                required
                className={inputStyle}
              />

              <p className="mt-2 text-sm text-gray-500">
                Enter exactly 11 digits starting with 0.
              </p>
            </div>

            {/* ALTERNATIVE CONTACT NAME */}
            <div>
              <label
                htmlFor="alternativeName"
                className="mb-3 block font-semibold"
              >
                Alternative Contact Person's Name
              </label>

              <input
                id="alternativeName"
                name="alternativeName"
                type="text"
                placeholder="Another person's name"
                className={inputStyle}
              />
            </div>

            {/* ALTERNATIVE PHONE NUMBER */}
            <div>
              <label
                htmlFor="alternativePhone"
                className="mb-3 block font-semibold"
              >
                Alternative Phone Number
              </label>

              <input
                id="alternativePhone"
                name="alternativePhone"
                type="tel"
                inputMode="numeric"
                placeholder="08012345678"
                pattern="0[0-9]{10}"
                minLength={11}
                maxLength={11}
                title="Enter exactly 11 digits starting with 0"
                onInput={handlePhoneInput}
                className={inputStyle}
              />

              <p className="mt-2 text-sm text-gray-500">
                Optional. Provide this number only
                with the person's permission.
              </p>
            </div>

            {/* DELIVERY INFORMATION */}
            <h3 className="border-b border-white/10 pb-4 pt-6 text-2xl font-bold">
              Delivery Information
            </h3>

            {/* DELIVERY ADDRESS */}
            <div>
              <label
                htmlFor="address"
                className="mb-3 block font-semibold"
              >
                Full Delivery Address *
              </label>

              <textarea
                id="address"
                name="address"
                rows={4}
                placeholder="House number, street, area and landmark"
                required
                className={inputStyle}
              />
            </div>

            {/* CUSTOMER LOCATION */}
            <div>
              <label
                htmlFor="location"
                className="mb-3 block font-semibold"
              >
                State / Town / Location *
              </label>

              <input
                id="location"
                name="location"
                type="text"
                placeholder="e.g. Otukpo, Benue State"
                required
                className={inputStyle}
              />
            </div>

            {/* DELIVERY PREFERENCE */}
            <div>
              <label
                htmlFor="deliveryPreference"
                className="mb-3 block font-semibold"
              >
                Delivery Preference *
              </label>

              <select
                id="deliveryPreference"
                name="deliveryPreference"
                required
                defaultValue=""
                className={inputStyle}
              >
                <option value="" disabled>
                  Select delivery preference
                </option>

                <option value="Home Delivery">
                  Home Delivery
                </option>

                <option value="Store Pickup">
                  Store Pickup
                </option>

                <option value="Discuss with SILVA">
                  Discuss with SILVA
                </option>
              </select>
            </div>

            {/* ADDITIONAL INFORMATION */}
            <div>
              <label
                htmlFor="note"
                className="mb-3 block font-semibold"
              >
                Additional Information (Optional)
              </label>

              <textarea
                id="note"
                name="note"
                rows={4}
                placeholder="Any additional request?"
                className={inputStyle}
              />
            </div>

            {/* SUBMIT REQUEST */}
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-8 py-5 text-lg font-bold transition hover:bg-blue-700"
            >
              Review and Submit Phone Request →
            </button>

            <p className="text-center text-sm leading-7 text-gray-400">
              You will be asked to confirm your information
              before continuing to WhatsApp.
              SILVA must confirm availability, pricing
              and delivery arrangements.
            </p>
          </form>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 border-t border-white/10 py-8 text-center text-sm text-gray-500">
          © 2026 SILVA CELEBRITY DEALER.
          All rights reserved.
        </footer>

      </div>
    </main>
  );
}

// SUSPENSE WRAPPER
export default function RequestPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#080b12] text-white">
          <p className="text-lg font-semibold">
            Loading phone request...
          </p>
        </main>
      }
    >
      <PhoneRequestContent />
    </Suspense>
  );
}