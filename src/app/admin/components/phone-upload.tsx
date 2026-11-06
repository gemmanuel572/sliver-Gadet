"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { uploadPhone } from "../actions";

export default function PhoneUpload() {
  const [request, setRequest] = useState<{ id: string; name: string; color: string; storage: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; name: string; color: string; storage: string }>).detail;
      setRequest(detail); setOpen(true); setError(""); setMessage(""); setPhotos([]); setPreviews([]);
      document.getElementById("phone-upload-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("upload-requested-phone", openRequest);
    return () => window.removeEventListener("upload-requested-phone", openRequest);
  }, []);

  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);

  function selectPhotos(files: File[]) {
    setPhotos(files);
    setPreviews(files.map(file => URL.createObjectURL(file)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await uploadPhone(new FormData(form));
      if (result.error) setError(result.error);
      else {
        setMessage("Phone published! It now appears in the store. Visitors on the homepage will see a new-phone notification automatically.");
        form.reset();
        selectPhotos([]);
        setRequest(null);
        window.dispatchEvent(new Event("admin-phones-changed"));
      }
    } catch {
      setError("The upload could not finish. Please try again with photos totalling no more than 4 MB.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="phone-upload-card" className="scroll-mt-6 rounded-2xl border border-white/10 bg-[#111827] p-7">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/10 text-3xl">📱</div>
      <h3 className="text-xl font-bold">Manage Products</h3>
      <p className="mt-3 text-sm leading-7 text-gray-400">Upload a phone to publish it on the homepage and notify visitors.</p>
      <button type="button" aria-expanded={open} aria-controls="phone-upload-form" onClick={() => setOpen(!open)} className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700">
        {open ? "Close Upload Form" : "Upload a Phone"}
      </button>
      {open && (
        <form key={request?.id || "new-phone"} id="phone-upload-form" onSubmit={submit} className="mt-6 space-y-5">
          {request && <p className="text-sm text-blue-400">Uploading for special request: {request.name}. This phone will appear on the website and be linked to this customer’s request.</p>}
          <input type="hidden" name="requestOrderId" value={request?.id || ""} />
          <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
            <div>
              <label htmlFor="phone-type" className="mb-2 block text-sm font-semibold">Phone Type / Model *</label>
              <input id="phone-type" name="phoneType" defaultValue={request?.name || ""} required maxLength={120} placeholder="e.g. iPhone 15 Pro Max" className="w-full rounded-lg border border-white/20 bg-[#080b12] px-4 py-3 outline-none focus:border-blue-500" />
            </div>
            {[
              { name: "brand", label: "Brand", placeholder: "e.g. Apple", maxLength: 80 },
              { name: "price", label: "Starting Price (₦)", placeholder: "e.g. 1250000", maxLength: undefined },
              { name: "colors", label: "Colours (separate with commas)", placeholder: "Black, Blue, Silver", maxLength: 2400 },
              { name: "storage", label: "Storage Options (separate with commas)", placeholder: "128GB, 256GB, 512GB", maxLength: 2400 },
            ].map(field => <div key={field.name}>
              <label htmlFor={`phone-${field.name}`} className="mb-2 block text-sm font-semibold">{field.label} *</label>
              <input id={`phone-${field.name}`} name={field.name} defaultValue={field.name === "colors" ? request?.color : field.name === "storage" ? request?.storage : undefined} type={field.name === "price" ? "number" : "text"} min={field.name === "price" ? "0.01" : undefined} max={field.name === "price" ? "1000000000" : undefined} step={field.name === "price" ? "0.01" : undefined} required maxLength={field.maxLength} placeholder={field.placeholder} className="w-full rounded-lg border border-white/20 bg-[#080b12] px-4 py-3 outline-none focus:border-blue-500" />
            </div>)}
            <div>
              <label htmlFor="phone-description" className="mb-2 block text-sm font-semibold">Description (optional)</label>
              <textarea id="phone-description" name="description" maxLength={2000} rows={3} className="w-full rounded-lg border border-white/20 bg-[#080b12] px-4 py-3 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="phone-photos" className="mb-2 block text-sm font-semibold">Phone Photos *</label>
              <input ref={fileInput} id="phone-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required aria-describedby="photo-help" onChange={event => {
                const selected = Array.from(event.target.files || []);
                setError(""); setMessage("");
                if (selected.length > 6 || selected.reduce((total, file) => total + file.size, 0) > 4 * 1024 * 1024) {
                  setError("Choose up to 6 photos, totalling no more than 4 MB.");
                  event.target.value = ""; selectPhotos([]); return;
                }
                selectPhotos(selected);
              }} className="w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-semibold file:text-white" />
              <p id="photo-help" className="mt-2 text-xs leading-6 text-gray-400">Choose one or more photos from your gallery or files. Up to 6 JPG, PNG or WebP photos, 4 MB total.</p>
            </div>
            {previews.length > 0 && <div className="grid grid-cols-3 gap-2">{previews.map((url, index) => <img key={url} src={url} alt={`Selected phone photo ${index + 1}`} className="h-24 w-full rounded-lg object-cover" />)}</div>}
            {photos.length > 0 && <button type="button" onClick={() => { selectPhotos([]); if (fileInput.current) fileInput.current.value = ""; }} className="text-sm text-blue-400">Clear selected photos</button>}
            <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700">{busy ? "Publishing…" : "Upload and Publish Phone"}</button>
            {request && <button type="button" onClick={() => { setRequest(null); selectPhotos([]); }} className="text-sm text-gray-400">Cancel linked upload</button>}
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {message && <p role="status" className="text-sm text-green-400">{message}</p>}
        </form>
      )}
    </div>
  );
}
