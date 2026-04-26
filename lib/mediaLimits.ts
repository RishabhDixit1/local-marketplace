const KB = 1024;
const MB = 1024 * KB;

export const POST_MEDIA_MAX_ATTACHMENTS = 4;
export const POST_MEDIA_IMAGE_MAX_BYTES = 768 * KB;
export const POST_MEDIA_VIDEO_MAX_BYTES = 6 * MB;
export const POST_MEDIA_AUDIO_MAX_BYTES = 3 * MB;
export const LISTING_IMAGE_MAX_BYTES = 640 * KB;
export const PROFILE_IMAGE_MAX_BYTES = 256 * KB;
export const POST_MEDIA_IMAGE_MAX_DIMENSION = 1280;
export const LISTING_IMAGE_MAX_DIMENSION = 1200;
export const PROFILE_IMAGE_MAX_DIMENSION = 512;
export const IMAGE_COMPRESSION_MAX_DIMENSION = POST_MEDIA_IMAGE_MAX_DIMENSION;
export const STORAGE_CACHE_SECONDS = "31536000";

export const getPostMediaLimitBytes = (mimeType: string) => {
  if (mimeType.startsWith("video/")) return POST_MEDIA_VIDEO_MAX_BYTES;
  if (mimeType.startsWith("audio/")) return POST_MEDIA_AUDIO_MAX_BYTES;
  return POST_MEDIA_IMAGE_MAX_BYTES;
};

export const formatUploadLimit = (bytes: number) => {
  if (bytes < MB) {
    return `${Math.round(bytes / KB)} KB`;
  }

  const value = bytes / MB;
  return Number.isInteger(value) ? `${value} MB` : `${value.toFixed(1)} MB`;
};

export const POST_MEDIA_LIMIT_COPY = `Images ${formatUploadLimit(POST_MEDIA_IMAGE_MAX_BYTES)}, videos ${formatUploadLimit(POST_MEDIA_VIDEO_MAX_BYTES)}, voice notes ${formatUploadLimit(POST_MEDIA_AUDIO_MAX_BYTES)}.`;
