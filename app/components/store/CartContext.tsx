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
import type { ProductDeliveryMethod } from "@/lib/provider/listings";
import { supabase } from "@/lib/supabase";

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
  deliveryMethod?: ProductDeliveryMethod | null;
};

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  hydrated: boolean;
  serverSynced: boolean;
  addItem: (item: Omit<CartItem, "key" | "quantity">) => void;
  replaceItems: (items: Array<Omit<CartItem, "key" | "quantity">>) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "serviq_cart_v1";
const CART_SCHEMA_VERSION = 3;
const STORAGE_VERSION_KEY = "serviq_cart_schema_v";

// ── Local storage helpers ───────────────────────────────────────────

const readFromStorage = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const storedVersion = window.localStorage.getItem(STORAGE_VERSION_KEY);
    if (storedVersion !== String(CART_SCHEMA_VERSION)) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(STORAGE_VERSION_KEY, String(CART_SCHEMA_VERSION));
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

// ── Server sync helpers ─────────────────────────────────────────────

async function fetchServerCart(): Promise<CartItem[] | null> {
  try {
    const session = await supabase.auth.getSession();
    if (!session.data.session) return null;
    const token = session.data.session.access_token;
    const res = await fetch("/api/cart", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body: { items: Record<string, unknown>[] } = await res.json();
    const items: CartItem[] = body.items.map((i: Record<string, unknown>) => {
      const raw = i.deliveryMethod;
      return {
        key: `${String(i.itemType)}:${String(i.itemId)}`,
        itemType: String(i.itemType) as "service" | "product",
        itemId: String(i.itemId),
        providerId: String(i.providerId),
        providerName: String(i.providerName ?? ""),
        title: String(i.title ?? ""),
        price: Number(i.price ?? 0),
        quantity: Number(i.quantity ?? 1),
        deliveryMethod: (raw != null && raw !== "" ? raw : null) as ProductDeliveryMethod | null,
      };
    });
    return items;
  } catch {
    return null;
  }
}

async function pushToServer(items: CartItem[]): Promise<boolean> {
  try {
    const session = await supabase.auth.getSession();
    if (!session.data.session) return false;
    const token = session.data.session.access_token;
    const res = await fetch("/api/cart", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: items.map(toPayload) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function toPayload(item: CartItem) {
  return {
    itemType: item.itemType,
    itemId: item.itemId,
    providerId: item.providerId,
    providerName: item.providerName,
    title: item.title,
    price: item.price,
    quantity: item.quantity,
    deliveryMethod: item.deliveryMethod,
  };
}

// Merge server items into local items — server wins on conflicts
function mergeCarts(local: CartItem[], server: CartItem[]): CartItem[] {
  if (server.length === 0) return local;
  if (local.length === 0) return server;
  const merged = new Map<string, CartItem>();
  for (const item of server) merged.set(item.key, item);
  for (const item of local) {
    if (!merged.has(item.key)) merged.set(item.key, item);
  }
  return Array.from(merged.values());
}

// ── Provider ────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [serverSynced, setServerSynced] = useState(false);
  const itemsRef = useRef<CartItem[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedItems = readFromStorage();
    itemsRef.current = storedItems;
    const hydrateTimer = window.setTimeout(() => {
      setItems(storedItems);
      setHydrated(true);
      hydratedRef.current = true;
    }, 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  // Sync from server after hydration + auth check
  useEffect(() => {
    if (!hydratedRef.current) return;
    let cancelled = false;
    (async () => {
      const serverItems = await fetchServerCart();
      if (cancelled) return;
      if (serverItems) {
        const merged = mergeCarts(itemsRef.current, serverItems);
        itemsRef.current = merged;
        writeToStorage(merged);
        setItems(merged);
      }
      setServerSynced(true);
    })();
    return () => { cancelled = true; };
  }, [hydrated]);

  // Debounced sync to server whenever items change (after initial server sync)
  useEffect(() => {
    if (!serverSynced) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      pushToServer(itemsRef.current);
    }, 2000);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items, serverSynced]);

  // Persist locally whenever items change
  useEffect(() => {
    if (!hydrated) return;
    itemsRef.current = items;
    writeToStorage(items);
  }, [hydrated, items]);

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

  const replaceItems = useCallback((incomingItems: Array<Omit<CartItem, "key" | "quantity">>) => {
    const nextItems = incomingItems.map((incoming) => ({
      ...incoming,
      key: `${incoming.itemType}:${incoming.itemId}`,
      quantity: 1,
    }));
    commitItems(nextItems);
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
    // Also clear server cart immediately
    supabase.auth.getSession().then((session) => {
      if (!session.data.session?.access_token) return;
      fetch("/api/cart", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.data.session.access_token}` },
      }).catch(() => {});
    });
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
      hydrated,
      serverSynced,
      addItem,
      replaceItems,
      removeItem,
      updateQuantity,
      clearCart,
      isOpen,
      openCart,
      closeCart,
    }),
    [
      items, totalItems, totalPrice, hydrated, serverSynced,
      addItem, replaceItems, removeItem, updateQuantity, clearCart,
      isOpen, openCart, closeCart,
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
