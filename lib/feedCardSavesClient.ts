import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAuthedJson } from "@/lib/clientApi";
import {
  createPendingFeedCardSave,
  type FeedCardSavePayload,
  type FeedCardSaveRecord,
  type FeedCardType,
} from "@/lib/feedCardSaves";

const STORAGE_KEY = "serviq-pending-feed-card-saves-v1";

type PendingFeedCardSaveState = Record<string, FeedCardSaveRecord[]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeNullableText = (value: unknown) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const normalizeFeedCardType = (value: unknown): FeedCardType | null => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "demand" || normalized === "service" || normalized === "product") {
    return normalized;
  }
  return null;
};

const canUseLocalStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const toFeedCardSaveRecord = (value: unknown): FeedCardSaveRecord | null => {
  if (!isRecord(value)) return null;

  const cardId = normalizeText(value.card_id);
  const focusId = normalizeText(value.focus_id);
  const cardType = normalizeFeedCardType(value.card_type);
  const title = normalizeText(value.title);

  if (!cardId || !focusId || !cardType || !title) {
    return null;
  }

  const createdAt = normalizeText(value.created_at) || new Date().toISOString();
  const updatedAt = normalizeText(value.updated_at) || createdAt;

  return {
    id: normalizeText(value.id) || `local-save:${cardId}`,
    card_id: cardId,
    focus_id: focusId,
    card_type: cardType,
    title,
    subtitle: normalizeNullableText(value.subtitle),
    action_path: normalizeNullableText(value.action_path),
    metadata: isRecord(value.metadata) ? value.metadata : null,
    created_at: createdAt,
    updated_at: updatedAt,
    sync_state: "pending",
  };
};

const readPendingFeedCardSaveState = (): PendingFeedCardSaveState => {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};

    const nextState: PendingFeedCardSaveState = {};

    Object.entries(parsed).forEach(([userId, rows]) => {
      const normalizedUserId = normalizeText(userId);
      if (!normalizedUserId || !Array.isArray(rows)) return;

      const normalizedRows = rows.map((row) => toFeedCardSaveRecord(row)).filter((row): row is FeedCardSaveRecord => !!row);
      if (normalizedRows.length > 0) {
        nextState[normalizedUserId] = normalizedRows;
      }
    });

    return nextState;
  } catch {
    return {};
  }
};

const writePendingFeedCardSaveState = (state: PendingFeedCardSaveState) => {
  if (!canUseLocalStorage()) return;

  const normalizedEntries = Object.entries(state).filter(([, rows]) => rows.length > 0);
  if (normalizedEntries.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(normalizedEntries)));
};

export const getPendingFeedCardSaves = (userId: string): FeedCardSaveRecord[] => {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return [];
  return readPendingFeedCardSaveState()[normalizedUserId] || [];
};

export const getPendingFeedCardIds = (userId: string): string[] =>
  getPendingFeedCardSaves(userId).map((row) => row.card_id);

export const stagePendingFeedCardSave = (userId: string, payload: FeedCardSavePayload) => {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) {
    return createPendingFeedCardSave(payload);
  }

  const state = readPendingFeedCardSaveState();
  const existingRows = state[normalizedUserId] || [];
  const existingRow = existingRows.find((row) => row.card_id === payload.card_id) || null;
  const nextRow = createPendingFeedCardSave(payload, existingRow);

  state[normalizedUserId] = [nextRow, ...existingRows.filter((row) => row.card_id !== payload.card_id)];
  writePendingFeedCardSaveState(state);

  return nextRow;
};

export const clearPendingFeedCardSave = (userId: string, cardId: string) => {
  const normalizedUserId = normalizeText(userId);
  const normalizedCardId = normalizeText(cardId);
  if (!normalizedUserId || !normalizedCardId) return;

  const state = readPendingFeedCardSaveState();
  const existingRows = state[normalizedUserId] || [];
  const nextRows = existingRows.filter((row) => row.card_id !== normalizedCardId);

  if (nextRows.length > 0) {
    state[normalizedUserId] = nextRows;
  } else {
    delete state[normalizedUserId];
  }

  writePendingFeedCardSaveState(state);
};

export const prunePendingFeedCardSaves = (userId: string, persistedCardIds: string[]) => {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId || persistedCardIds.length === 0) return;

  const persistedCardIdSet = new Set(persistedCardIds.map((value) => normalizeText(value)).filter(Boolean));
  if (persistedCardIdSet.size === 0) return;

  const state = readPendingFeedCardSaveState();
  const existingRows = state[normalizedUserId] || [];
  const nextRows = existingRows.filter((row) => !persistedCardIdSet.has(row.card_id));

  if (nextRows.length > 0) {
    state[normalizedUserId] = nextRows;
  } else {
    delete state[normalizedUserId];
  }

  writePendingFeedCardSaveState(state);
};

const postFeedCardSaveAction = async (supabase: SupabaseClient, body: Record<string, unknown>) => {
  await fetchAuthedJson<{ ok: true }>(supabase, "/api/feed-card-saves", {
    method: "POST",
    body: JSON.stringify(body),
    keepalive: true,
  });
};

export const persistFeedCardSave = async (supabase: SupabaseClient, payload: FeedCardSavePayload) => {
  await postFeedCardSaveAction(supabase, {
    action: "save",
    card: payload,
  });
};

export const removeFeedCardSave = async (supabase: SupabaseClient, cardId: string) => {
  await postFeedCardSaveAction(supabase, {
    action: "remove",
    cardId,
  });
};

export const syncPendingFeedCardSaves = async (supabase: SupabaseClient, userId: string, persistedCardIds: string[]) => {
  const pendingRows = getPendingFeedCardSaves(userId);
  if (pendingRows.length === 0) return 0;

  const persistedCardIdSet = new Set(persistedCardIds);
  const unsyncedRows = pendingRows.filter((row) => !persistedCardIdSet.has(row.card_id));
  if (unsyncedRows.length === 0) return 0;

  const results = await Promise.allSettled(unsyncedRows.map((row) => persistFeedCardSave(supabase, row)));
  const syncedCardIds = unsyncedRows
    .filter((_, index) => results[index]?.status === "fulfilled")
    .map((row) => row.card_id);

  if (syncedCardIds.length > 0) {
    prunePendingFeedCardSaves(userId, syncedCardIds);
  }

  return syncedCardIds.length;
};
