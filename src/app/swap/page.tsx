"use client";

import Link from "next/link";
import { type FormEvent } from "react";

const inputStyle = "w-full rounded-xl border border-white/15 bg-[#080b12] px-4 py-4 outline-none focus:border-blue-500";

export default function SwapPage() {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || "").trim();
    if (!value("currentPhone") || !value("wantedPhone") || !value("condition")) {
      alert("Enter the phone you have, its condition and the phone you want."); return;
    }
    const phone = value("phone");
    if (phone && !/^0[0-9]{10}$/.test(phone)) { alert("Enter an 11-digit Nigerian phone number starting with 0."); return; }
    const message = `Hello SILVA CELEBRITY DEALER!

I would like to discuss a phone swap deal.

PHONE I HAVE: ${value("currentPhone")}
Current phone condition: ${value("condition")}
PHONE I WANT: ${value("wantedPhone")}

Name: ${value("customerName") || "Not provided"}
Contact number: ${phone || "Please contact me on WhatsApp"}
Preferred discussion: ${value("meeting")}
Additional details: ${value("note") || "None"}

Please let me know if this swap is possible, any extra amount required, and when we can discuss it or meet at your shop in Otukpo. I understand the phones must be inspected and the deal agreed before a swap.`;
    window.location.assign("https://wa.me/2348137596850?text=" + encodeURIComponent(message));
  }

  return <main className="min-h-screen bg-[#080b12] text-white">
    <nav className="border-b border-white/10 px-6 py-6"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/" className="text-2xl font-black">SILVA<span className="text-blue-500">.</span></Link><Link href="/" className="text-sm text-blue-400">← Back to Store</Link></div></nav>
    <section className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-sm font-bold uppercase tracking-widest text-blue-400">Swap Deal</p>
      <h1 className="mt-3 text-4xl font-black">Ready for a different phone?</h1>
      <p className="mt-5 leading-8 text-gray-400">Tell SILVA which phone you are using and which phone you would like to swap to. Discuss the deal on WhatsApp or arrange to meet at the shop in Otukpo, Benue State.</p>
      <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-[#111827] p-6 md:p-8">
        {[
          { name: "currentPhone", label: "Phone You Are Using *", placeholder: "e.g. iPhone 13, 128GB, Blue", required: true },
          { name: "wantedPhone", label: "Phone You Want *", placeholder: "e.g. iPhone 15 Pro, 256GB", required: true },
          { name: "customerName", label: "Your Name (optional)", placeholder: "Your name", required: false },
        ].map(field => <div key={field.name}><label htmlFor={field.name} className="mb-2 block font-semibold">{field.label}</label><input id={field.name} name={field.name} type="text" required={field.required} maxLength={160} placeholder={field.placeholder} className={inputStyle} /></div>)}
        <div><label htmlFor="condition" className="mb-2 block font-semibold">Your Phone’s Condition *</label><textarea id="condition" name="condition" rows={4} maxLength={1000} required placeholder="Battery health, screen condition, any faults or repairs, and included accessories" className={inputStyle} /></div>
        <div><label htmlFor="phone" className="mb-2 block font-semibold">Contact Number (optional)</label><input id="phone" name="phone" type="tel" inputMode="numeric" pattern="0[0-9]{10}" maxLength={11} placeholder="08012345678" className={inputStyle} /></div>
        <div><label htmlFor="meeting" className="mb-2 block font-semibold">How Would You Like to Discuss It?</label><select id="meeting" name="meeting" className={inputStyle}><option>Chat on WhatsApp</option><option>Meet at the shop in Otukpo</option><option>Discuss on WhatsApp, then meet at the shop</option></select></div>
        <div><label htmlFor="note" className="mb-2 block font-semibold">Anything Else? (optional)</label><textarea id="note" name="note" rows={3} maxLength={1000} placeholder="Preferred meeting time, budget for a top-up, or other questions" className={inputStyle} /></div>
        <p className="text-sm leading-7 text-gray-400">SILVA will confirm availability, inspect your phone and agree any price difference with you. Opening WhatsApp prepares your request; press Send there to send it.</p>
        <button type="submit" className="w-full rounded-xl bg-blue-600 px-6 py-4 font-bold hover:bg-blue-700">Discuss Swap on WhatsApp →</button>
      </form>
    </section>
  </main>;
}
