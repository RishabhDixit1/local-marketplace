import type { ProfileFormValues, ProfileRecord, StoredProfileRole } from "@/lib/profile/types";

export type ProfileApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "CONFIG"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DB"
  | "UNKNOWN";

export type ProfileApiError = {
  ok: false;
  code: ProfileApiErrorCode;
  message: string;
  details?: string;
};

export type SaveProfileRequest = {
  values: ProfileFormValues;
  storedRole?: StoredProfileRole;
  metadataPatch?: Record<string, unknown>;
};

export type SaveProfileSuccess = {
  ok: true;
  profile: ProfileRecord;
  compatibilityMode: boolean;
  strippedColumns: string[];
};

export type SaveProfileResponse = SaveProfileSuccess | ProfileApiError;

export type UploadProfileAvatarSuccess = {
  ok: true;
  publicUrl: string;
  compatibilityMode: boolean;
};

export type UploadProfileAvatarResponse = UploadProfileAvatarSuccess | ProfileApiError;
