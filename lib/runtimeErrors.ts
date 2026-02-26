export const isAbortLikeError = (error: unknown) => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error instanceof Error) {
    return /aborterror|signal is aborted|aborted without reason/i.test(error.message);
  }

  return false;
};

export const isFailedFetchError = (error: unknown) => {
  if (error instanceof TypeError) {
    return /failed to fetch/i.test(error.message);
  }

  if (error instanceof Error) {
    return /failed to fetch|network request failed/i.test(error.message);
  }

  return false;
};

export const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
};
