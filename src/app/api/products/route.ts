import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { products, type Product } from "@/data/products";
import { defaultConditions, reportForPhone } from "@/lib/phone-conditions";
import { applyInventoryOverrides } from "@/lib/inventory";

function isMissingTable(error: { code?: string } | null) {
  return Boolean(error && ["PGRST205", "42P01"].includes(error.code || ""));
}

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const supabase = await createClient();
    const { data: availability, error: availabilityError } = await supabase.from("phone_availability")
      .select("product_id,booked,is_removed,overrides");
    if (availabilityError && !isMissingTable(availabilityError)) throw availabilityError;
    const booked = new Set((availability || []).filter(phone => phone.booked || phone.is_removed).map(phone => phone.product_id));
    const overrides = new Map((availability || []).map(phone => [phone.product_id, phone.overrides]));
    const { data: reports, error: reportError } = await supabase.from("phone_condition_reports").select("product_id,conditions,field_labels,removed_fields");
    if (reportError && !isMissingTable(reportError)) throw reportError;
    const savedConditions = new Map((reports || []).map(report => [report.product_id, report]));
    const { data, error } = await supabase.from("phone_uploads")
      .select("id,name,brand,price,description,colors,storage,photo_paths,created_at")
      .eq("is_published", true).order("created_at", { ascending: false });
    if (error && !isMissingTable(error)) throw error;

    const uploaded: Product[] = await Promise.all((data || []).filter(phone => !booked.has(phone.id)).map(async phone => {
      const { data: photos, error: photoError } = await supabase.storage.from("phone-photos")
        .createSignedUrls(phone.photo_paths, 3600);
      if (photoError || !photos?.length || photos.some(photo => !photo.signedUrl)) {
        throw photoError || new Error("Phone photos unavailable");
      }
      const images = photos.map(photo => {
        if (!photo.signedUrl) throw new Error("Phone photo unavailable");
        return photo.signedUrl;
      });
      return {
        id: phone.id, name: phone.name, brand: phone.brand, price: Number(phone.price),
        description: phone.description || "Contact SILVA for more information about this phone.",
        colors: phone.colors, storage: phone.storage, image: images[0], images,
        createdAt: phone.created_at,
        conditions: defaultConditions(phone.brand),
      };
    }));
    return NextResponse.json({ products: [...uploaded, ...products.filter(phone => !booked.has(phone.id))].map(phone => {
      const current = applyInventoryOverrides(phone, overrides.get(phone.id));
      return { ...current, ...reportForPhone(current.brand, current.conditions, savedConditions.get(phone.id)) };
    }) }, { headers });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    console.error("Store catalogue database read failed", { code });
    return NextResponse.json({ error: "Our phone catalogue is temporarily unavailable. Please contact SILVA on WhatsApp for availability." }, { status: 503, headers });
  }
}
