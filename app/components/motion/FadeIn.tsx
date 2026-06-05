"use client";

import { motion } from "framer-motion";

export function FadeIn({
  children,
  delay = 0,
  y = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay, ease: [0.2, 0.8, 0.2, 1] } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeInScale({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { duration: 0.35, delay, ease: [0.2, 0.8, 0.2, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
