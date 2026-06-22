"use client";

import { useEffect, useState, useRef } from "react";
import { TypingIndicator } from "./TypingIndicator";

export function StreamingText({
  stream,
  done,
}: {
  stream: ReadableStream<string> | null;
  done: () => void;
}) {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const doneRef = useRef(done);
  doneRef.current = done;

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    setIsStreaming(true);

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    async function read() {
      try {
        while (true) {
          const { value, done: doneReading } = await reader.read();
          if (cancelled) break;
          if (doneReading) break;
          const chunk = typeof value === "string" ? value : decoder.decode(value, { stream: true });
          setText((prev) => prev + chunk);
        }
      } catch {
        // stream cancelled or errored
      } finally {
        if (!cancelled) {
          setIsStreaming(false);
          doneRef.current();
        }
        reader.releaseLock();
      }
    }

    read();

    return () => {
      cancelled = true;
      reader.cancel().catch(() => {});
    };
  }, [stream]);

  if (!text && !isStreaming) return null;

  return (
    <span>
      {text}
      {isStreaming && <TypingIndicator />}
    </span>
  );
}
