import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/server/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("logs info messages with module prefix", () => {
    logger.info("test-module", "hello world");
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[INFO\] \[test-module\]/),
      "hello world",
    );
  });

  it("logs error messages with error details", () => {
    const err = new Error("something broke");
    logger.error("test-module", "operation failed", err);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[ERROR\] \[test-module\]/),
      "operation failed something broke",
      expect.stringContaining("Error: something broke"),
    );
  });

  it("logs errors without Error object", () => {
    logger.error("test-module", "failed", "string error");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[ERROR\] \[test-module\]/),
      "failed string error",
      "",
    );
  });

  it("outputs JSON in production", () => {
    process.env.NODE_ENV = "production";
    logger.info("payments", "payment captured", { amount: 50000 });
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"level":"info"'),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"module":"payments"'),
    );
  });
});
