export type PostType = "need" | "service" | "product";
export type PostMode = "urgent" | "schedule";

export type UploadedMediaPayload = {
  name: string;
  url: string;
  type: string;
};

export type PublishPayloadBase = {
  title: string;
  details: string;
  category: string;
  budget: number | null;
  locationLabel: string;
  radiusKm: number;
  mode: PostMode;
  neededWithin: string;
  scheduleDate: string;
  scheduleTime: string;
  flexibleTiming: boolean;
  media: UploadedMediaPayload[];
};

export type PublishPostRequest = PublishPayloadBase & {
  postType: Exclude<PostType, "need">;
};

export type PublishNeedRequest = PublishPayloadBase & {
  postType: "need";
  latitude?: number | null;
  longitude?: number | null;
};

export type PublishApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "CONFIG"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DB"
  | "UNKNOWN";

export type PublishApiError = {
  ok: false;
  code: PublishApiErrorCode;
  message: string;
  details?: string;
};

export type PublishPostSuccess = {
  ok: true;
  postId: string;
  postType: "service" | "product";
};

export type PublishNeedSuccess = {
  ok: true;
  postId?: string;
  helpRequestId?: string;
  matchedCount: number;
  notifiedProviders: number;
  firstNotificationLatencyMs: number;
};

export type PublishPostResponse = PublishPostSuccess | PublishApiError;
export type PublishNeedResponse = PublishNeedSuccess | PublishApiError;
