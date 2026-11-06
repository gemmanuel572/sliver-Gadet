export type OrderStatus = "pending" | "processing" | "awaiting_confirmation" | "completed";
export type OrderDetails = {
  color: string; storage: string; condition: string; quantity: number;
  customerName: string; phone: string; alternativeName: string; alternativePhone: string;
  address: string; location: string; deliveryPreference: string; note: string;
};
export type CustomerOrder = {
  id: string; customer_id: string; customer_email: string; product_id: string | null;
  phone_name: string; listed_price: number | null; kind: "product" | "request";
  details: OrderDetails; status: OrderStatus; created_at: string;
  request_available?: boolean; published_product_id?: string | null;
};
export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Awaiting SILVA’s confirmation", processing: "Booking confirmed",
  awaiting_confirmation: "Delivered — customer verification needed", completed: "Delivery verified",
};
