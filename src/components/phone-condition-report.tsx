import { conditionLabels, isConditionVerified, type PhoneConditions } from "@/lib/phone-conditions";

export default function PhoneConditionReport({ conditions, labels = {}, compact = false }: { conditions: PhoneConditions; labels?: Record<string, string>; compact?: boolean }) {
  if (!Object.keys(conditions).length) return <p className="text-sm text-gray-400">No inspection fields have been published for this phone.</p>;
  return <dl className={compact ? "space-y-3" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
    {Object.keys(conditions).map(key => <div key={key} className={compact ? "border-b border-white/10 pb-3 last:border-0" : "rounded-2xl border border-white/10 bg-[#111827] p-6"}>
      <dt className="text-sm text-gray-400">{labels[key] || conditionLabels[key] || key}</dt>
      <dd className={`${compact ? "mt-1 text-sm" : "mt-3 text-lg"} break-words font-bold ${isConditionVerified(conditions[key]) ? "text-white" : "text-yellow-400"}`}>{conditions[key]}</dd>
    </div>)}
  </dl>;
}
