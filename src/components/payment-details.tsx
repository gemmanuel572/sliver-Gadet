export default function PaymentDetails() {
  return <aside className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
    <h3 className="font-bold text-yellow-400">Payment Details — Awaiting SILVA</h3>
    <dl className="mt-3 space-y-2 text-sm text-gray-300">
      <div><dt className="inline">Account number: </dt><dd className="inline font-mono">0000000000 (placeholder)</dd></div>
      <div><dt className="inline">Bank: </dt><dd className="inline">To be provided</dd></div>
      <div><dt className="inline">Account name: </dt><dd className="inline">To be provided by SILVA</dd></div>
    </dl>
    <p className="mt-3 text-sm leading-6 text-yellow-200">Do not transfer money to this placeholder. Contact SILVA for confirmed pricing and real payment details before paying.</p>
  </aside>;
}
