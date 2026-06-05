"use client";

import { motion } from "framer-motion";

const container = {
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

const item = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
  },
};

export function StaggerContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={container} initial="initial" animate="animate">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={item}>{children}</motion.div>;
}
