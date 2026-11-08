"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAdminConditionPhones, saveInspectionField } from "../actions";
import { conditionKeys, conditionLabels, isConditionVerified, isReportVerified, UNVERIFIED, type PhoneConditions } from "@/lib/phone-conditions";
import { notifyCatalogueChanged } from "@/lib/catalogue-events";

type Phone = { id: string; name: string; brand: string; conditions: PhoneConditions; conditionLabels: Record<string, string> };
const inputStyle = "mt-2 w-full rounded-lg border border-white/20 bg-[#080b12] px-4 py-3 outline-none focus:border-blue-500";

export default function PhoneConditionManager() {
  const [open, setOpen] = useState(false);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Phone | null>(null);
  const [showVerified, setShowVerified] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const refresh = useCallback(() => getAdminConditionPhones().then(result => {
    if (result.error) { setError(result.error); return; }
    const current = result.phones || [];
    setPhones(current); setError("");
    setSelected(phone => phone && !current.some(item => item.id === phone.id) ? null : phone);
  }).catch(() => setError("Could not load published phone reports. Please try again."))
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    if (!open) return;
    const onRefresh = () => { if (!document.hidden) void refresh(); };
    const interval = window.setInterval(onRefresh, 20000);
    window.addEventListener("admin-phones-changed", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => { window.clearInterval(interval); window.removeEventListener("admin-phones-changed", onRefresh); window.removeEventListener("focus", onRefresh); };
  }, [open, refresh]);

  async function saveField(key: string, label: string, value: string, operation: "save" | "clear" | "remove") {
    if (!selected || busy) return;
    if (operation === "remove" && !window.confirm(`Remove ${label} from ${selected.name}’s report? Other phones will not change.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveInspectionField(selected.id, key, label, value, operation);
      if (result.error) { setError(result.error); return; }
      const update = (phone: Phone): Phone => {
        if (phone.id !== selected.id) return phone;
        const conditions = { ...phone.conditions }; const labels = { ...phone.conditionLabels };
        if (operation === "remove") { delete conditions[key]; delete labels[key]; }
        else { conditions[key] = operation === "clear" ? UNVERIFIED : value.trim() || UNVERIFIED; labels[key] = label.trim(); }
        return { ...phone, conditions, conditionLabels: labels };
      };
      setSelected(phone => phone ? update(phone) : null);
      setPhones(current => current.map(update));
      setMessage(`${label}: ${operation === "remove" ? "removed from this phone" : operation === "clear" ? "reset to Not yet verified" : "saved"}. Customer pages update automatically.`);
      if (!(key in selected.conditions)) { setNewLabel(""); setNewValue(""); }
      notifyCatalogueChanged();
    } catch { setError("Could not save this field. Please try again; your draft is still here."); }
    finally { setBusy(false); }
  }

  const pending = phones.filter(phone => !isReportVerified(phone.conditions));
  const visible = showVerified ? phones : pending;

  return <div className={`rounded-2xl border border-white/10 bg-[#111827] p-7 ${open ? "md:col-span-2 lg:col-span-3" : ""}`}>
    <div className="mb-5 text-3xl">🔍</div><h3 className="text-xl font-bold">Phone Conditions</h3>
    <p className="mt-3 text-sm leading-7 text-gray-400">Edit reports for phones currently listed on the customer website. Save, rename, clear or remove each field independently.</p>
    <button type="button" disabled={busy} aria-expanded={open} aria-controls="phone-condition-manager" onClick={() => { setOpen(!open); if (!open) { setLoading(true); void refresh(); } }} className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50">{open ? "Close Phone Conditions" : "Manage Phone Conditions"}</button>
    {open && <div id="phone-condition-manager" className="mt-6">
      {loading && <p role="status">Loading published phones…</p>}
      {error && <p role="alert" className="mb-4 text-red-400">{error}</p>}
      {message && <p role="status" className="mb-4 text-green-400">{message}</p>}
      <button type="button" disabled={busy} onClick={() => void refresh()} className="mb-4 text-sm text-blue-400 underline">Reload Published Phones</button>
      {!loading && !error && <>
        <p className="text-sm text-gray-400">{phones.length} published phones · {pending.length} with unverified checks.</p>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={showVerified} onChange={event => setShowVerified(event.target.checked)} />Include completed reports</label>
        {visible.length === 0 && <p className="mt-5 text-gray-400">{phones.length ? "No phones need inspection." : "No phones are currently published in the store."}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(phone => <button key={phone.id} type="button" disabled={busy} onClick={() => { setSelected({ ...phone, conditions: { ...phone.conditions }, conditionLabels: { ...phone.conditionLabels } }); setError(""); setMessage(""); setNewLabel(""); setNewValue(""); }} className="rounded-lg border border-white/15 p-4 text-left hover:border-blue-500 disabled:opacity-50">
          <span className="block font-semibold">{phone.name}</span><span className="mt-2 block text-sm text-gray-400">{isReportVerified(phone.conditions) ? "Inspection complete — edit report" : `${Object.values(phone.conditions).filter(value => !isConditionVerified(value)).length} checks unverified — edit report`}</span>
        </button>)}</div>
      </>}
      {selected && <section className="mt-8 border-t border-white/10 pt-6">
        <h4 className="text-xl font-bold">Inspect {selected.name}</h4>
        <Link href={`/products/${selected.id}#condition-report`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-400 underline">View customer report →</Link>
        <p className="mt-3 text-sm leading-7 text-gray-400">Record actual results, including faults. Clear resets a result to “Not yet verified”. Remove hides only that field on this phone. Label and result edits are published when you save that field.</p>
        <fieldset disabled={busy} className="mt-5 grid gap-5 md:grid-cols-2 disabled:opacity-60">
          {Object.entries(selected.conditions).map(([key, value]) => <div key={key} className="rounded-xl border border-white/10 p-4">
            <label htmlFor={`inspection-label-${key}`} className="text-xs text-gray-400">Field label</label>
            <input id={`inspection-label-${key}`} aria-label={`Label for ${conditionLabels[key] || key}`} maxLength={80} value={selected.conditionLabels[key] || conditionLabels[key] || key} onChange={event => setSelected({ ...selected, conditionLabels: { ...selected.conditionLabels, [key]: event.target.value } })} className={inputStyle} />
            <label htmlFor={`inspection-${key}`} className="mt-3 block text-xs text-gray-400">Inspection result</label>
            <input id={`inspection-${key}`} maxLength={160} value={value} onChange={event => setSelected({ ...selected, conditions: { ...selected.conditions, [key]: event.target.value } })} placeholder={UNVERIFIED} className={inputStyle} />
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void saveField(key, selected.conditionLabels[key] || conditionLabels[key] || key, value, "save")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Save Field</button>
              <button type="button" onClick={() => void saveField(key, selected.conditionLabels[key] || conditionLabels[key] || key, value, "clear")} className="text-sm text-blue-400">Clear Result</button>
              <button type="button" onClick={() => void saveField(key, selected.conditionLabels[key] || conditionLabels[key] || key, value, "remove")} className="text-sm text-red-400">Remove Field</button>
            </div>
          </div>)}
          <div className="rounded-xl border border-blue-500/30 p-4 md:col-span-2">
            <h5 className="font-bold">Add an Inspection Field</h5>
            <label htmlFor="new-condition-label" className="mt-3 block text-sm text-gray-400">Field label</label>
            <input id="new-condition-label" list="standard-inspection-labels" maxLength={80} value={newLabel} onChange={event => setNewLabel(event.target.value)} placeholder="e.g. SIM Tray, Back Glass" className={inputStyle} />
            <datalist id="standard-inspection-labels">{conditionKeys.filter(key => key !== "trueTone" || selected.brand.toLowerCase() === "apple").map(key => <option key={key} value={conditionLabels[key]} />)}</datalist>
            <label htmlFor="new-condition-value" className="mt-3 block text-sm text-gray-400">Result (optional)</label>
            <input id="new-condition-value" maxLength={160} value={newValue} onChange={event => setNewValue(event.target.value)} placeholder={UNVERIFIED} className={inputStyle} />
            <button type="button" disabled={!newLabel.trim()} onClick={() => {
              const standard = conditionKeys.find(key => conditionLabels[key].toLowerCase() === newLabel.trim().toLowerCase());
              const key = standard || `custom_${crypto.randomUUID()}`;
              if (key in selected.conditions || Object.keys(selected.conditions).some(item => (selected.conditionLabels[item] || conditionLabels[item] || item).toLowerCase() === newLabel.trim().toLowerCase())) { setError("This phone already has that field. Edit it above."); return; }
              void saveField(key, newLabel, newValue, "save");
            }} className="mt-4 rounded-lg bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50">Add and Save Field</button>
          </div>
        </fieldset>
      </section>}
    </div>}
  </div>;
}
