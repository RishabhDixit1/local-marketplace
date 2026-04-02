import { describe, expect, it } from "vitest";
import { insertTextAtSelection } from "../../lib/chatComposer";

describe("insertTextAtSelection", () => {
  it("inserts text at the provided caret position", () => {
    expect(insertTextAtSelection("Hello there", ":)", 5, 5)).toEqual({
      value: "Hello:) there",
      caretPosition: 7,
    });
  });

  it("replaces the selected text range", () => {
    expect(insertTextAtSelection("Need help soon", "😊", 5, 9)).toEqual({
      value: "Need 😊 soon",
      caretPosition: 7,
    });
  });

  it("defaults to appending at the end when no selection is provided", () => {
    expect(insertTextAtSelection("Thanks", "🙏")).toEqual({
      value: "Thanks🙏",
      caretPosition: 8,
    });
  });

  it("clamps invalid selection ranges into the current message bounds", () => {
    expect(insertTextAtSelection("Hi", "!", -4, 99)).toEqual({
      value: "!",
      caretPosition: 1,
    });
  });
});
