import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, type FlexibleSchema } from "ai";

const DEFAULT_MODEL = "gpt-4o-mini";

export function getModel(model?: string) {
  return openai(model ?? DEFAULT_MODEL);
}

export async function generate<T>({
  prompt,
  schema,
  system,
  model,
}: {
  prompt: string;
  schema: FlexibleSchema<T>;
  system?: string;
  model?: string;
}): Promise<T> {
  const result = await generateObject({
    model: getModel(model),
    schema,
    prompt,
    system,
  });
  return result.object as T;
}

export async function generateTextResponse({
  prompt,
  system,
  model,
}: {
  prompt: string;
  system?: string;
  model?: string;
}) {
  const result = await generateText({
    model: getModel(model),
    prompt,
    system,
    temperature: 0.7,
  });
  return result.text;
}
