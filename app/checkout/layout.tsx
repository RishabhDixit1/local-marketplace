import type { ReactNode } from "react";
import { CartProvider } from "@/app/components/store/CartContext";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
