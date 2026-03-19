export type FeedCardType = "demand" | "service" | "product";

export type FeedCardSavePayload = {
  card_id: string;
  focus_id: string;
  card_type: FeedCardType;
  title: string;
  subtitle: string | null;
  action_path: string | null;
  metadata: Record<string, unknown> | null;
};

export type FeedCardSaveRecord = FeedCardSavePayload & {
  id: string;
  created_at: string;
  updated_at: string;
  sync_state?: "pending" | "synced";
};

const LOCAL_RECORD_ID_PREFIX = "local-save:";

const toTimestamp = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized || new Date().toISOString();
};

const toSortTime = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const createPendingFeedCardSave = (
  payload: FeedCardSavePayload,
  existing?: FeedCardSaveRecord | null
): FeedCardSaveRecord => {
  const createdAt = toTimestamp(existing?.created_at);

  return {
    ...payload,
    id: existing?.id || `${LOCAL_RECORD_ID_PREFIX}${payload.card_id}`,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    sync_state: "pending",
  };
};

export const mergeFeedCardSaves = (
  serverRows: FeedCardSaveRecord[],
  pendingRows: FeedCardSaveRecord[]
): FeedCardSaveRecord[] => {
  const byCardId = new Map<string, FeedCardSaveRecord>();

  serverRows.forEach((row) => {
    if (!row.card_id) return;
    byCardId.set(row.card_id, {
      ...row,
      sync_state: "synced",
    });
  });

  pendingRows.forEach((row) => {
    if (!row.card_id || byCardId.has(row.card_id)) return;
    byCardId.set(row.card_id, {
      ...row,
      sync_state: "pending",
    });
  });

  return Array.from(byCardId.values()).sort((left, right) => toSortTime(right.created_at) - toSortTime(left.created_at));
};
