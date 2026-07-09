import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Crossing Republik",
  description: "Explore local services and products in Crossing Republik, Ghaziabad",
};

export default function CrossingRepublikPage() {
  redirect("/market/zone/crossing-republik");
}
