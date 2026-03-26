"use client";

const MODAL_COUNT_ATTR = "data-public-profile-modal-count";
const MODAL_OPEN_ATTR = "data-public-profile-modal-open";

const getModalCount = (body: HTMLElement) => {
  const rawValue = Number(body.getAttribute(MODAL_COUNT_ATTR) || "0");
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
};

export const setPublicProfileModalOpen = (open: boolean) => {
  if (typeof document === "undefined") return;

  const { body } = document;
  const nextCount = open ? getModalCount(body) + 1 : Math.max(0, getModalCount(body) - 1);

  if (nextCount > 0) {
    body.setAttribute(MODAL_COUNT_ATTR, String(nextCount));
    body.setAttribute(MODAL_OPEN_ATTR, "true");
    return;
  }

  body.removeAttribute(MODAL_COUNT_ATTR);
  body.removeAttribute(MODAL_OPEN_ATTR);
};
