export const PROFILE_BIO_MIN_LENGTH = 32;
export const PROFILE_TOPIC_LIMIT = 15;
export const PROFILE_AUTOSAVE_DEBOUNCE_MS = 1600;
export const PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_ROUTE = "/dashboard/profile";
export const POST_LOGIN_REDIRECT_ROUTE = "/dashboard";

export type StoredProfileRole = "provider" | "business" | "seeker";
export type ProfileRoleFamily = "provider" | "seeker";
export type ProfileAvailability = "available" | "busy" | "offline";

export type ProfileRecord = {
  id: string;
  full_name: string | null;
  name: string | null;
  location: string | null;
  role: StoredProfileRole;
  bio: string | null;
  interests: string[];
  services: string[];
  email: string | null;
  phone: string | null;
  website: string | null;
  avatar_url: string | null;
  availability: ProfileAvailability;
  onboarding_completed: boolean;
  profile_completion_percent: number;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type ProfileFormValues = {
  fullName: string;
  location: string;
  role: ProfileRoleFamily;
  bio: string;
  interests: string[];
  email: string;
  phone: string;
  website: string;
  avatarUrl: string;
  availability: ProfileAvailability;
};

export type ProfileValidationErrors = Partial<
  Record<"fullName" | "location" | "role" | "bio" | "interests" | "email" | "phone" | "website" | "avatarUrl" | "form", string>
>;

export type ProfileCompletionItem = {
  id: "fullName" | "location" | "role" | "bio" | "interests" | "contact" | "avatar";
  label: string;
  complete: boolean;
  helper: string;
  requiredForOnboarding?: boolean;
};
