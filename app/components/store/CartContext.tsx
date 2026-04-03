"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  /** Unique key: `${itemType}:${itemId}` */
  key: string;
  itemType: "service" | "product";
  itemId: string;
  providerId: string;
  providerName: string;
  title: string;
  price: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: Omit<CartItem, "key" | "quantity">) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "serviq_cart_v1";
const CART_SCHEMA_VERSION = 2; // Bump this to force a cart reset on schema changes
const STORAGE_VERSION_KEY = "serviq_cart_schema_v";

const readFromStorage = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    // Check schema version — if mismatch, clear and reset
    const storedVersion = window.localStorage.getItem(STORAGE_VERSION_KEY);
    if (storedVersion !== String(CART_SCHEMA_VERSION)) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(STORAGE_VERSION_KEY, String(CART_SCHEMA_VERSION));
      console.info("[cart] schema version mismatch — cart cleared");
      return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as CartItem).key === "string" &&
        typeof (item as CartItem).itemId === "string" &&
        typeof (item as CartItem).providerId === "string" &&
        typeof (item as CartItem).price === "number" &&
        (item as CartItem).quantity > 0
    );
  } catch {
    // Shape invalid — clear corrupted data
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return [];
  }
};

const writeToStorage = (items: CartItem[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_VERSION_KEY, String(CART_SCHEMA_VERSION));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors.
  }
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const itemsRef = useRef<CartItem[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedItems = readFromStorage();
    itemsRef.current = storedItems;
    setItems(storedItems);
  }, []);

  // Persist whenever items change
  useEffect(() => {
    itemsRef.current = items;
    writeToStorage(items);
  }, [items]);

  const commitItems = useCallback((nextItems: CartItem[]) => {
    itemsRef.current = nextItems;
    writeToStorage(nextItems);
    setItems(nextItems);
  }, []);

  const addItem = useCallback((incoming: Omit<CartItem, "key" | "quantity">) => {
    const key = `${incoming.itemType}:${incoming.itemId}`;
    const currentItems = itemsRef.current;
    const existing = currentItems.find((item) => item.key === key);
    const nextItems = existing
      ? currentItems.map((item) => (item.key === key ? { ...item, quantity: item.quantity + 1 } : item))
      : [...currentItems, { ...incoming, key, quantity: 1 }];
    commitItems(nextItems);
    setIsOpen(true);
  }, [commitItems]);

  const removeItem = useCallback((key: string) => {
    commitItems(itemsRef.current.filter((item) => item.key !== key));
  }, [commitItems]);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    if (quantity <= 0) {
      commitItems(itemsRef.current.filter((item) => item.key !== key));
      return;
    }
    commitItems(itemsRef.current.map((item) => (item.key === key ? { ...item, quantity } : item)));
  }, [commitItems]);

  const clearCart = useCallback(() => {
    commitItems([]);
  }, [commitItems]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      totalPrice,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isOpen,
      openCart,
      closeCart,
    }),
    [
      items,
      totalItems,
      totalPrice,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isOpen,
      openCart,
      closeCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}
