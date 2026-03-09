import {
  PROFILE_BIO_MIN_LENGTH,
  PROFILE_TOPIC_LIMIT,
  type ProfileFormValues,
  type ProfileValidationErrors,
} from "@/lib/profile/types";
import { normalizePhone, normalizeTopics, normalizeWebsite } from "@/lib/profile/utils";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateProfileValues = (
  values: ProfileFormValues,
  options?: { mode?: "submit" | "draft" }
): ProfileValidationErrors => {
  const mode = options?.mode || "submit";
  const errors: ProfileValidationErrors = {};
  const topics = normalizeTopics(values.interests);
  const shouldRequireOnboardingFields = mode === "submit";

  if (shouldRequireOnboardingFields && !values.fullName.trim()) {
    errors.fullName = "Enter your full name.";
  } else if (shouldRequireOnboardingFields && values.fullName.trim().length < 2) {
    errors.fullName = "Use at least 2 characters.";
  }

  if (shouldRequireOnboardingFields && !values.location.trim()) {
    errors.location = "Enter your city, neighborhood, or service area.";
  } else if (shouldRequireOnboardingFields && values.location.trim().length < 2) {
    errors.location = "Location is too short.";
  }

  if (shouldRequireOnboardingFields && !values.role) {
    errors.role = "Choose whether you provide services or are looking for them.";
  }

  if (shouldRequireOnboardingFields && !values.bio.trim()) {
    errors.bio = "Write a short description so others know what to expect.";
  } else if (shouldRequireOnboardingFields && values.bio.trim().length < PROFILE_BIO_MIN_LENGTH) {
    errors.bio = `Use at least ${PROFILE_BIO_MIN_LENGTH} characters.`;
  }

  if (shouldRequireOnboardingFields && topics.length === 0) {
    errors.interests = "Add at least one service, skill, or interest.";
  } else if (topics.length > PROFILE_TOPIC_LIMIT) {
    errors.interests = `Use at most ${PROFILE_TOPIC_LIMIT} tags.`;
  }

  if (values.email.trim() && !emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (values.phone.trim()) {
    const normalizedPhone = normalizePhone(values.phone);
    const digitCount = normalizedPhone.replace(/\D/g, "").length;
    if (digitCount < 7 || digitCount > 15) {
      errors.phone = "Enter a valid phone number.";
    }
  }

  if (values.website.trim() && !normalizeWebsite(values.website)) {
    errors.website = "Enter a valid website URL.";
  }

  if (values.avatarUrl.trim() && !/^https?:\/\//i.test(values.avatarUrl.trim())) {
    errors.avatarUrl = "Avatar URL must be a valid public URL.";
  }

  return errors;
};

export const canAutosaveProfile = (values: ProfileFormValues) =>
  Object.keys(validateProfileValues(values, { mode: "draft" })).length === 0;
