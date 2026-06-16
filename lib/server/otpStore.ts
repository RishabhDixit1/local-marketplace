interface OtpEntry {
  email: string;
  otp: string;
  expiresAt: number;
  userId: string;
}

const store = new Map<string, OtpEntry>();

const TTL = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 60 * 1000);

export const createOtp = (email: string): { otp: string; userId: string } => {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const userId = crypto.randomUUID();
  store.set(email, { email, otp, expiresAt: Date.now() + TTL, userId });
  return { otp, userId };
};

export const verifyOtp = (email: string, otp: string): { userId: string } | null => {
  const entry = store.get(email);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(email);
    return null;
  }
  if (entry.otp !== otp) return null;
  store.delete(email);
  return { userId: entry.userId };
};

export const clearOtp = (email: string) => {
  store.delete(email);
};
