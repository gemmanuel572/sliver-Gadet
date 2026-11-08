import CustomerDetails from "./customer-details";
export default async function CustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetails customerId={id} />;
}
