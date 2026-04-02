export type TextInsertionResult = {
  value: string;
  caretPosition: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const insertTextAtSelection = (
  currentValue: string,
  insertedText: string,
  selectionStart?: number | null,
  selectionEnd?: number | null
): TextInsertionResult => {
  const safeValue = currentValue ?? "";
  const start = clamp(typeof selectionStart === "number" ? selectionStart : safeValue.length, 0, safeValue.length);
  const end = clamp(typeof selectionEnd === "number" ? selectionEnd : start, start, safeValue.length);
  const value = `${safeValue.slice(0, start)}${insertedText}${safeValue.slice(end)}`;

  return {
    value,
    caretPosition: start + insertedText.length,
  };
};
