"use client";

import { motion } from "framer-motion";

export function PressScale({
  children,
  className,
  as = "button",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "button" | "div" | "a";
  onClick?: () => void;
}) {
  const Component = motion[as as keyof typeof motion] as React.ComponentType<{
    children: React.ReactNode;
    className?: string;
    whileTap?: object;
    whileHover?: object;
    transition?: object;
    onClick?: () => void;
  }>;
  return (
    <Component
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={className}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}
