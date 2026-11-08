"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  type FormEvent,
} from "react";
import { useProducts } from "@/hooks/use-products";
import { isReportVerified } from "@/lib/phone-conditions";
import { useOrderSubmission } from "@/hooks/use-order-submission";
import PaymentDetails from "@/components/payment-details";
import PhoneConditionReport from "@/components/phone-condition-report";
import {
  ensureSignedIn,
  restorePendingOrder,
} from "@/lib/order-auth";

const inputStyle =
  "w-full rounded-xl border border-white/10 bg-[#080b12] px-4 py-4 text-white outline-none focus:border-blue-500";

// VALIDATE NIGERIAN PHONE NUMBERS
function isValidPhone(number: string) {
  return /^0[0-9]{10}$/.test(number);
}

// REMOVE LETTERS AND SYMBOLS
function handlePhoneInput(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = event.currentTarget.value
    .replace(/\D/g, "")
    .slice(0, 11);
}

function ProductDetailsContent() {
  const params = useParams();
  const { products, loading, error } = useProducts();
  const { saveOrder, saving } = useOrderSubmission();

  const product = products.find(
    (item) => item.id === params.id
  );

  // RESTORE FORM DETAILS AFTER GOOGLE LOGIN
  useEffect(() => {
    const form = document.getElementById(
      "silva-order-form"
    );

    if (form instanceof HTMLFormElement) {
      restorePendingOrder(form);
    }
    if (window.location.hash === "#condition-report") {
      document.getElementById("condition-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [product?.id]);

  // HANDLE CUSTOMER ORDER
  async function handleOrder(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    // Remember the form element before the async operation.
    const submittedForm = event.currentTarget;

    if (!product) return;

    const form = new FormData(submittedForm);

    const getValue = (name: string) =>
      String(form.get(name) || "").trim();

    // PHONE DETAILS
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
    const deliveryPreference = getValue(
      "deliveryPreference"
    );

    const note = getValue("note");

    // VALIDATE MAIN PHONE NUMBER
    if (!isValidPhone(phone)) {
      alert(
        "Enter a valid Nigerian phone number: " +
          "exactly 11 digits starting with 0."
      );
      return;
    }

    // VALIDATE ALTERNATIVE PHONE NUMBER
    if (
      alternativePhone &&
      !isValidPhone(alternativePhone)
    ) {
      alert(
        "Enter a valid 11-digit alternative phone number."
      );
      return;
    }

    // VALIDATE CUSTOMER NAME
    const namePattern = /^[\p{L}\s'.-]+$/u;

    if (
      !customerName ||
      !namePattern.test(customerName)
    ) {
      alert(
        "Please enter a valid full name using letters."
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
      alert(
        "Please enter a valid quantity of at least 1."
      );
      return;
    }

    // REQUIRE LOGIN BEFORE CONFIRMING THE ORDER
    const signedIn = await ensureSignedIn(submittedForm);

    if (!signedIn) {
      return;
    }

    // CUSTOMER CONFIRMATION
    const confirmed = window.confirm(
      `PLEASE CONFIRM YOUR ORDER

PHONE DETAILS
Phone: ${product.name}
Colour: ${color}
Storage: ${storage}
Condition: ${condition}
Quantity: ${quantity}

CUSTOMER DETAILS
Name: ${customerName}
Phone Number: ${phone}
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

    if (!confirmed) {
      return;
    }

    const saved = await saveOrder(form, product.id);
    if (!("orderId" in saved)) { alert(saved.error); return; }

    // PREPARE WHATSAPP MESSAGE
    const message = `
Hello SILVA CELEBRITY DEALER!

Order Reference: ${saved.orderId}

I would like to enquire about this phone.

PHONE DETAILS

Phone: ${product.name}
Listed Starting Price: ₦${product.price.toLocaleString("en-NG")}
Colour: ${color}
Storage: ${storage}
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

Please confirm availability, actual condition and final price.

Thank you!
`;

    const whatsappURL =
      "https://wa.me/2348137596850?text=" +
      encodeURIComponent(message);

    // CONTINUE TO WHATSAPP
    window.location.assign(whatsappURL);
  }

  // PHONE NOT FOUND
  if (!product) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#080b12] px-6 text-white">
        <h1 className="text-3xl font-black">
          {loading ? "Loading phone details…" : error ? "Unable to load this phone" : "Phone unavailable or no longer listed"}
        </h1>
        {error && <p role="alert" className="mt-4 text-gray-400">{error}</p>}

        <Link
          href="/"
          className="mt-6 text-blue-400 hover:underline"
        >
          ← Back to Homepage
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      {/* NAVIGATION */}
      <nav className="border-b border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-black">
            SILVA
            <span className="text-blue-500">.</span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-blue-400"
          >
            ← Back to Store
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* PHONE INFORMATION */}
        <section className="grid gap-12 md:grid-cols-2">
          <div className="overflow-hidden rounded-3xl bg-white p-6">
            <img
              src={product.image}
              alt={product.name}
              className="h-[400px] w-full object-contain"
            />
            {product.images && product.images.length > 1 && <div className="mt-4 grid grid-cols-3 gap-3">{product.images.slice(1).map((image, index) => <a key={image} href={image} target="_blank" rel="noreferrer"><img src={image} alt={`${product.name} photo ${index + 2}`} className="h-28 w-full rounded-lg object-contain" /></a>)}</div>}
          </div>

          <div className="flex flex-col justify-center">
            <p className="font-bold uppercase tracking-widest text-blue-400">
              {product.brand}
            </p>

            <h1 className="mt-4 text-4xl font-black md:text-5xl">
              {product.name}
            </h1>

            <p className="mt-6 text-3xl font-black text-blue-400">
              ₦{product.price.toLocaleString("en-NG")}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              Listed starting price. Final price depends
              on specifications and availability.
            </p>

            <p className="mt-6 leading-8 text-gray-400">
              {product.description}
            </p>

            <div className="mt-8 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
              <h3 className="font-bold text-yellow-400">
                {isReportVerified(product.conditions) ? "Inspection Complete" : "Important Condition Information"}
              </h3>

              <p className="mt-2 text-sm leading-7 text-gray-300">
                {isReportVerified(product.conditions)
                  ? "SILVA has recorded every inspection result. Review the report below for actual condition, faults or replaced parts before payment."
                  : 'Review the condition report below. Any details marked "Not yet verified" must be confirmed by SILVA before payment.'}
              </p>
            </div>

            <a
              href="#order"
              className="mt-8 rounded-xl bg-blue-600 px-8 py-4 text-center font-bold hover:bg-blue-700"
            >
              Book / Enquire About This Phone →
            </a>
          </div>
        </section>

        {/* PHONE CONDITION REPORT */}
        <section id="condition-report" className="mt-20 scroll-mt-6">
          <p className="font-bold uppercase tracking-widest text-blue-400">
            Device Inspection
          </p>

          <h2 className="mt-3 text-3xl font-black">
            Phone Condition Report
          </h2>

          <p className="mt-4 text-gray-400">
            You can view the condition report
            without creating an account.
          </p>

          <div className="mt-8"><PhoneConditionReport conditions={product.conditions} labels={product.conditionLabels} /></div>
        </section>

        {/* ORDER FORM */}
        <section
          id="order"
          className="mt-20 rounded-3xl border border-white/10 bg-[#111827] p-6 md:p-12"
        >
          <p className="font-bold uppercase tracking-widest text-blue-400">
            Place Your Enquiry
          </p>

          <h2 className="mt-3 text-3xl font-black md:text-4xl">
            Book Your Phone
          </h2>

          <p className="mt-4 text-gray-400">
            Choose your preferred phone specifications
            and enter your contact information.
          </p>

          <form
            id="silva-order-form"
            onSubmit={handleOrder}
            className="mt-10 space-y-7"
          >
            <PaymentDetails />
            {/* COLOUR */}
            <div>
              <label
                htmlFor="color"
                className="mb-3 block font-semibold"
              >
                Choose Phone Colour *
              </label>

              <select
                id="color"
                name="color"
                required
                defaultValue=""
                className={inputStyle}
              >
                <option value="" disabled>
                  Select phone colour
                </option>

                {product.colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>

            {/* STORAGE */}
            <div>
              <label
                htmlFor="storage"
                className="mb-3 block font-semibold"
              >
                Choose Storage Capacity *
              </label>

              <select
                id="storage"
                name="storage"
                required
                defaultValue=""
                className={inputStyle}
              >
                <option value="" disabled>
                  Select storage capacity
                </option>

                {product.storage.map((storage) => (
                  <option key={storage} value={storage}>
                    {storage}
                  </option>
                ))}
              </select>
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
                  Select preferred condition
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
              </select>

              <p className="mt-2 text-sm text-gray-500">
                SILVA must confirm availability.
              </p>
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

            {/* CUSTOMER NAME */}
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
                Alternative Contact Person&apos;s Name
              </label>

              <input
                id="alternativeName"
                name="alternativeName"
                type="text"
                placeholder="Another person's name"
                className={inputStyle}
              />
            </div>

            {/* ALTERNATIVE PHONE */}
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
                with the person&apos;s permission.
              </p>
            </div>

            {/* DELIVERY INFORMATION */}
            <h3 className="border-b border-white/10 pb-4 pt-6 text-2xl font-bold">
              Delivery Information
            </h3>

            {/* ADDRESS */}
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

            {/* LOCATION */}
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

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-8 py-5 text-lg font-bold transition hover:bg-blue-700"
            >
              {saving ? "Saving Order…" : "Review and Submit Order →"}
            </button>

            <p className="text-center text-sm leading-7 text-gray-400">
              A customer account is required to proceed.
              After signing in, you can review and confirm
              your order before opening WhatsApp.
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

// NEXT.JS SUSPENSE WRAPPER
export default function ProductDetails() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#080b12] text-white">
          Loading phone details...
        </main>
      }
    >
      <ProductDetailsContent />
    </Suspense>
  );
}
