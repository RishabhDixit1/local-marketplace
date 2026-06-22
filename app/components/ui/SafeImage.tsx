"use client";

import { useState } from "react";
import Image from "next/image";

type SafeImageProps = {
  src: string | null | undefined;
  alt: string;
  fallback?: React.ReactNode;
  className?: string;
  fill?: true;
  sizes?: string;
  width?: number;
  height?: number;
};

export function SafeImage({ src, alt, fallback, className, fill, width, height, sizes }: SafeImageProps) {
  if (!src) {
    return <>{fallback}</>;
  }

  if (/^(data:image\/|blob:)/i.test(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} />;
  }

  return <SafeNextImage src={src} alt={alt} fallback={fallback} className={className} fill={fill === true} width={width} height={height} sizes={sizes} />;
}

function SafeNextImage({
  src,
  alt,
  fallback,
  className,
  fill,
  sizes,
  width,
  height,
}: {
  src: string;
  alt: string;
  fallback?: React.ReactNode;
  className?: string;
  fill: boolean;
  sizes?: string;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <>{fallback}</>;
  }

  if (fill) {
    return <Image src={src} alt={alt} fill sizes={sizes ?? "100%"} className={className} onError={() => setFailed(true)} unoptimized={src.includes("54.253.40.174")} />;
  }

  return <Image src={src} alt={alt} width={width!} height={height!} className={className} onError={() => setFailed(true)} unoptimized={src.includes("54.253.40.174")} />;
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500",
  "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500",
  "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500",
  "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500",
];

export function InitialsAvatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const colorIndex = hashCode(name) % AVATAR_COLORS.length;

  const sizeMap: Record<string, string> = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-xl",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white ${AVATAR_COLORS[colorIndex]} ${sizeMap[size]} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
