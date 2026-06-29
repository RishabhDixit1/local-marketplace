import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText, type FlexibleSchema } from "ai";

const DEFAULT_MODEL = "gemini-2.0-flash";

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

export function getModel(model?: string) {
  return googleProvider(model ?? DEFAULT_MODEL);
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
