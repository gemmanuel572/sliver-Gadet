"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getAdminConditionPhones, savePhoneConditions } from "../actions";
import { conditionKeys, conditionLabels, isConditionVerified, isReportVerified, UNVERIFIED, type PhoneConditions } from "@/lib/phone-conditions";
import { notifyCatalogueChanged } from "@/lib/catalogue-events";

type Phone = { id: string; name: string; conditions: PhoneConditions };

export default function PhoneConditionManager() {
  const [open, setOpen] = useState(false);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Phone | null>(null);
  const [showVerified, setShowVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedPhone, setSavedPhone] = useState<Phone | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  function refresh() {
    setLoading(true);
    return getAdminConditionPhones().then(result => {
      setSetupRequired("setupRequired" in result && Boolean(result.setupRequired));
      if (result.error) setError(result.error);
      else setError("");
      if (result.phones) setPhones(result.phones);
    }).catch(() => setError("Could not load phone conditions. Please try again."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const onUpload = () => { if (open) void refresh(); };
    window.addEventListener("admin-phones-changed", onUpload);
    return () => window.removeEventListener("admin-phones-changed", onUpload);
  }, [open]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (setupRequired) { setError("Complete the Supabase database setup before saving phone conditions."); return; }
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const complete = !(submitter instanceof HTMLButtonElement && submitter.value === "progress");
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await savePhoneConditions(selected.id, selected.conditions, complete);
      if (result.error) { setError(result.error); return; }
      setPhones(current => current.map(phone => phone.id === selected.id ? selected : phone));
      setMessage(`${selected.name}: conditions saved to the customer homepage and phone report. Other visitors’ pages update within 20 seconds.`);
      setSavedPhone(selected);
      notifyCatalogueChanged();
      setSelected(null);
    } catch { setError("Could not save the report. Your changes are still here; please try again."); }
    finally { setBusy(false); }
  }

  const pending = phones.filter(phone => !isReportVerified(phone.conditions));
  const visible = showVerified ? phones : pending;

  return <div className={`rounded-2xl border border-white/10 bg-[#111827] p-7 ${open ? "md:col-span-2 lg:col-span-3" : ""}`}>
    <div className="mb-5 text-3xl">🔍</div>
    <h3 className="text-xl font-bold">Phone Conditions</h3>
    <p className="mt-3 text-sm leading-7 text-gray-400">Edit the condition reports shown on the customer homepage. Saved results replace “Not yet verified” for that phone.</p>
    <button type="button" disabled={busy} aria-expanded={open} aria-controls="phone-condition-manager" onClick={() => { setOpen(!open); if (!open) void refresh(); }} className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50">{open ? "Close Phone Conditions" : "Verify Phone Conditions"}</button>
    {open && <div id="phone-condition-manager" className="mt-6">
      {setupRequired && <div role="alert" className="mb-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-sm text-yellow-300"><p className="font-bold">Database setup required</p><p className="mt-2 leading-7">The homepage phones are listed below, but their reports cannot be saved yet. Run <code>supabase/setup.sql</code> once in the Supabase SQL editor, then press Reload phone list. No phone is marked verified automatically.</p></div>}
      {loading && <p role="status">Loading phone conditions…</p>}
      {error && <div className="mb-4"><p role="alert" className="text-red-400">{error}</p><button type="button" disabled={busy} onClick={() => void refresh()} className="mt-2 text-blue-400 underline">Reload phone list</button></div>}
      {message && <p role="status" className="mb-4 text-green-400">{message}</p>}
      {savedPhone && message && <Link href={`/products/${savedPhone.id}#condition-report`} target="_blank" rel="noreferrer" className="mb-4 inline-block text-sm text-blue-400 underline">View updated customer condition report →</Link>}
      {!loading && <>
        <p className="text-sm text-gray-400">{pending.length} phones still need inspection.</p>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={showVerified} onChange={event => setShowVerified(event.target.checked)} />Include completed reports</label>
        {!error && visible.length === 0 && <p className="mt-5 text-green-400">No phones need verification.</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(phone => <button key={phone.id} type="button" disabled={busy} onClick={() => { setSelected({ ...phone, conditions: { ...phone.conditions } }); setError(""); setMessage(""); }} className="rounded-lg border border-white/15 p-4 text-left hover:border-blue-500 disabled:opacity-50">
          <span className="block font-semibold">{phone.name}</span><span className="mt-2 block text-sm text-gray-400">{isReportVerified(phone.conditions) ? "Inspection complete — edit report" : `${conditionKeys.filter(key => !isConditionVerified(phone.conditions[key])).length} checks unverified — inspect phone`}</span>
        </button>)}</div>
      </>}
      {selected && <form key={selected.id} onSubmit={save} className="mt-8 border-t border-white/10 pt-6">
        <h4 className="text-xl font-bold">Inspect {selected.name}</h4>
        <Link href={`/products/${selected.id}#condition-report`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-400 underline">Open this phone’s customer condition section →</Link>
        <p className="mt-3 text-sm leading-7 text-gray-400">Enter actual results, including faults or replaced parts. Leave untested items as “Not yet verified”. A completed inspection means every check has a result; it does not mean every part works.</p>
        <fieldset disabled={busy || setupRequired} className="mt-5 grid gap-5 sm:grid-cols-2 disabled:opacity-60">
          {conditionKeys.map(key => <div key={key}>
            <label htmlFor={`inspection-${key}`} className="mb-2 block text-sm font-semibold">{conditionLabels[key]}</label>
            <input id={`inspection-${key}`} required maxLength={160} list={key === "batteryHealth" ? undefined : "inspection-results"} value={selected.conditions[key]} onChange={event => setSelected({ ...selected, conditions: { ...selected.conditions, [key]: event.target.value } })} placeholder={key === "batteryHealth" ? "e.g. 92% — tested" : "Enter the inspection result"} className="w-full rounded-lg border border-white/20 bg-[#080b12] px-4 py-3 outline-none focus:border-blue-500" />
          </div>)}
          <datalist id="inspection-results"><option value={UNVERIFIED} /><option value="Working — tested" /><option value="Faulty" /><option value="Replaced — working" /><option value="Not applicable" /></datalist>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" value="verify" className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700">{busy ? "Saving…" : "Verify and Publish Conditions"}</button>
            <button type="submit" value="progress" className="rounded-lg border border-blue-500 px-5 py-3 text-blue-400">Save Progress</button>
            <button type="button" onClick={() => setSelected(null)} className="px-5 py-3 text-gray-400">Cancel</button>
          </div>
        </fieldset>
      </form>}
    </div>}
  </div>;
}
