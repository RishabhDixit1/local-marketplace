export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description: string;
  created_at: string;
  updated_at: string;
};

export type FeatureFlagOverride = {
  user_id: string;
  flag_key: string;
  enabled: boolean;
};

export const FEATURE_FLAGS_TABLE = "feature_flags";
export const FEATURE_FLAG_OVERRIDES_TABLE = "feature_flag_overrides";
