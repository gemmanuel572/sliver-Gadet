import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { products, type Product } from "@/data/products";
import { defaultConditions, mergeConditions } from "@/lib/phone-conditions";

function isMissingTable(error: { code?: string } | null) {
  return Boolean(error && ["PGRST205", "42P01"].includes(error.code || ""));
}

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const supabase = await createClient();
    const { data: availability, error: availabilityError } = await supabase.from("phone_availability")
      .select("product_id").eq("booked", true);
    if (availabilityError && !isMissingTable(availabilityError)) throw availabilityError;
    const booked = new Set((availability || []).map(phone => phone.product_id));
    const { data: reports, error: reportError } = await supabase.from("phone_condition_reports").select("product_id,conditions");
    if (reportError && !isMissingTable(reportError)) throw reportError;
    const savedConditions = new Map((reports || []).map(report => [report.product_id, report.conditions]));
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
        conditions: mergeConditions(defaultConditions(phone.brand), savedConditions.get(phone.id)),
      };
    }));
    return NextResponse.json({ products: [...uploaded, ...products.filter(phone => !booked.has(phone.id)).map(phone => ({ ...phone, conditions: mergeConditions(phone.conditions, savedConditions.get(phone.id)) }))] }, { headers });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    console.error("Store catalogue database read failed", { code });
    return NextResponse.json({ error: "Our phone catalogue is temporarily unavailable. Please contact SILVA on WhatsApp for availability." }, { status: 503, headers });
  }
}
