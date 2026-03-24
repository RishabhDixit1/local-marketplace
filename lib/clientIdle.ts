"use client";

type IdleTask = () => void;

type IdleWindow = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: () => void,
    options?: {
      timeout?: number;
    }
  ) => number;
};

export const scheduleClientIdleTask = (task: IdleTask, timeout = 1500) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => {
      task();
    }, { timeout });

    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const handle = window.setTimeout(task, Math.min(timeout, 250));
  return () => {
    window.clearTimeout(handle);
  };
};
