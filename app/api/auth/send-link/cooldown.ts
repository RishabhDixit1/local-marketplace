const MAGIC_LINK_COOLDOWN_MS = 60_000;
const lastMagicLinkRequestByEmail = new Map<string, number>();

const pruneExpiredMagicLinkCooldowns = (now: number) => {
  lastMagicLinkRequestByEmail.forEach((timestamp, email) => {
    if (now - timestamp >= MAGIC_LINK_COOLDOWN_MS) {
      lastMagicLinkRequestByEmail.delete(email);
    }
  });
};

const getLastMagicLinkRequestAt = (email: string) => lastMagicLinkRequestByEmail.get(email) ?? 0;

const recordMagicLinkRequest = (email: string, requestedAt = Date.now()) => {
  lastMagicLinkRequestByEmail.set(email, requestedAt);
};

const resetMagicLinkRequestCooldownForTests = () => {
  lastMagicLinkRequestByEmail.clear();
};

export {
  MAGIC_LINK_COOLDOWN_MS,
  getLastMagicLinkRequestAt,
  pruneExpiredMagicLinkCooldowns,
  recordMagicLinkRequest,
  resetMagicLinkRequestCooldownForTests,
};
