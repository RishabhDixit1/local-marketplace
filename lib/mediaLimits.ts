const MB = 1024 * 1024;

export const POST_MEDIA_MAX_ATTACHMENTS = 6;
export const POST_MEDIA_IMAGE_MAX_BYTES = 2 * MB;
export const POST_MEDIA_VIDEO_MAX_BYTES = 8 * MB;
export const POST_MEDIA_AUDIO_MAX_BYTES = 4 * MB;
export const LISTING_IMAGE_MAX_BYTES = 2 * MB;
export const PROFILE_IMAGE_MAX_BYTES = 2 * MB;
export const IMAGE_COMPRESSION_MAX_DIMENSION = 1600;
export const STORAGE_CACHE_SECONDS = "31536000";

export const getPostMediaLimitBytes = (mimeType: string) => {
  if (mimeType.startsWith("video/")) return POST_MEDIA_VIDEO_MAX_BYTES;
  if (mimeType.startsWith("audio/")) return POST_MEDIA_AUDIO_MAX_BYTES;
  return POST_MEDIA_IMAGE_MAX_BYTES;
};

export const formatUploadLimit = (bytes: number) => {
  const value = bytes / MB;
  return Number.isInteger(value) ? `${value} MB` : `${value.toFixed(1)} MB`;
};

export const POST_MEDIA_LIMIT_COPY = `Images ${formatUploadLimit(POST_MEDIA_IMAGE_MAX_BYTES)}, videos ${formatUploadLimit(POST_MEDIA_VIDEO_MAX_BYTES)}, voice notes ${formatUploadLimit(POST_MEDIA_AUDIO_MAX_BYTES)}.`;
