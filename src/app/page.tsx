import { redirect } from "next/navigation";

// This repo is the Farm City owner dashboard. The customer-facing storefront
// lives in the FARM-CITY repo; here the home page goes straight to the
// dashboard.
export default function Home() {
  redirect("/admin");
}
