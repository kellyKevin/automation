import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <>
      <h2 className="category">Orders</h2>
      <p className="muted">
        Confirm stock, verify payments, and advance orders. Each change notifies
        the customer on WhatsApp and is recorded in the order history.
      </p>
      <AdminClient />
    </>
  );
}
