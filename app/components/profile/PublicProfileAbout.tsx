"use client";

import { useEffect, useRef, useState } from "react";

type PublicProfileAboutProps = {
  bio: string | null;
};

export default function PublicProfileAbout({ bio }: PublicProfileAboutProps) {
  const content = bio?.trim() || "This member has not added a longer public summary yet.";
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const node = textRef.current;
    if (!node) return;

    const measure = () => {
      setCanExpand(node.scrollHeight > node.clientHeight + 1);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [content, expanded]);

  return (
    <div>
      <h2 className="text-[2rem] font-semibold tracking-tight text-slate-950">About</h2>
      <p
        ref={textRef}
        className={`mt-4 text-base leading-8 text-slate-700 ${expanded ? "" : "line-clamp-4"}`}
      >
        {content}
      </p>

      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 text-sm font-semibold text-[#0a66c2] transition hover:text-[#004182]"
        >
          {expanded ? "Show less" : "More details"}
        </button>
      ) : null}
    </div>
  );
}
