"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Data ─────────────────────────────────────────────────────────────────────

type Category = "Repair" | "Personal" | "Urgent" | "Elderly" | "Student" | "Micro";

type GhostTask = {
  id: string;
  label: string;
  category: Category;
  top: number;  // percentage
  left: number; // percentage
};

const TASKS: { label: string; category: Category }[] = [
  // Repair
  { label: "Fix leaking tap", category: "Repair" },
  { label: "AC not cooling", category: "Repair" },
  { label: "TV wall mounting", category: "Repair" },
  { label: "Door lock repair", category: "Repair" },
  { label: "Washing machine check", category: "Repair" },
  { label: "Furniture assembly", category: "Repair" },
  // Personal
  { label: "Carry heavy luggage", category: "Personal" },
  { label: "Help shifting/moving", category: "Personal" },
  { label: "Pickup or drop nearby", category: "Personal" },
  { label: "Stand in queue", category: "Personal" },
  { label: "Urgent document printing", category: "Personal" },
  { label: "Tech help for phone/UPI", category: "Personal" },
  // Urgent
  { label: "Buy medicine urgently", category: "Urgent" },
  { label: "Late-night milk/groceries", category: "Urgent" },
  { label: "Find plumber instantly", category: "Urgent" },
  { label: "Get keys duplicated", category: "Urgent" },
  { label: "Borrow tools locally", category: "Urgent" },
  { label: "Emergency hardware item", category: "Urgent" },
  // Elderly
  { label: "Hospital visit assistance", category: "Elderly" },
  { label: "Walking support/companion", category: "Elderly" },
  { label: "Online bill payment help", category: "Elderly" },
  { label: "Tech help for seniors", category: "Elderly" },
  { label: "Bank visit assistance", category: "Elderly" },
  // Student
  { label: "Quick tutoring/doubts", category: "Student" },
  { label: "Resume & interview prep", category: "Student" },
  { label: "Coding/project help", category: "Student" },
  // Micro
  { label: "Pet walking or feeding", category: "Micro" },
  { label: "Car or bike cleaning", category: "Micro" },
  { label: "Event/decoration setup", category: "Micro" },
  { label: "Small garden/clean-up", category: "Micro" },
];

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  Category,
  { dot: string; badge: string; emoji: string }
> = {
  Repair:   { dot: "bg-orange-500",  badge: "text-orange-700",  emoji: "🔧" },
  Personal: { dot: "bg-violet-500",  badge: "text-violet-700",  emoji: "🙋" },
  Urgent:   { dot: "bg-rose-500",    badge: "text-rose-700",    emoji: "⚡" },
  Elderly:  { dot: "bg-teal-500",    badge: "text-teal-700",    emoji: "🤝" },
  Student:  { dot: "bg-blue-500",    badge: "text-blue-700",    emoji: "📚" },
  Micro:    { dot: "bg-emerald-500", badge: "text-emerald-700", emoji: "✨" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_BUBBLES = 5;
const SPAWN_INTERVAL_MS = 2000;
const BUBBLE_LIFETIME_MS = 4000;

function randBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Framer Motion variants ───────────────────────────────────────────────────

const bubbleVariants = {
  initial: {
    opacity: 0,
    scale: 0.4,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 380,
      damping: 22,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.6,
    transition: {
      duration: 0.35,
      ease: "easeIn" as const,
    },
  },
};

// Continuous bobbing after entry
const floatTransition = {
  y: {
    duration: 2.8,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export type LiveTaskOverlayProps = {
  /** Pass false to pause spawning (e.g. when map is not visible) */
  active?: boolean;
};

export default function LiveTaskOverlay({ active = true }: LiveTaskOverlayProps) {
  const [bubbles, setBubbles] = useState<GhostTask[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeBubble = (id: string) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
    timeoutsRef.current.delete(id);
  };

  const spawnBubble = () => {
    setBubbles((prev) => {
      if (prev.length >= MAX_BUBBLES) return prev;

      const task = pickRandom(TASKS);
      const id = `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newBubble: GhostTask = {
        id,
        label: task.label,
        category: task.category,
        top: randBetween(10, 78),
        left: randBetween(8, 72),
      };

      // Schedule auto-removal after BUBBLE_LIFETIME_MS
      const t = setTimeout(() => removeBubble(id), BUBBLE_LIFETIME_MS);
      timeoutsRef.current.set(id, t);

      return [...prev, newBubble];
    });
  };

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(spawnBubble, SPAWN_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Clear all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <AnimatePresence>
        {bubbles.map((bubble) => {
          const meta = CATEGORY_META[bubble.category];
          return (
            <motion.div
              key={bubble.id}
              variants={bubbleVariants}
              initial="initial"
              animate={["animate", "float"]}
              exit="exit"
              style={{
                position: "absolute",
                top: `${bubble.top}%`,
                left: `${bubble.left}%`,
              }}
              // Bobbing is layered on top of the spring entry
              whileInView={{ y: [0, -7, 0] }}
              transition={{
                ...floatTransition,
                // Spring entry runs first; bobbing begins post-mount via the
                // `animate` prop with a small delay so they don't clash.
              }}
            >
              {/* Glassmorphism bubble */}
              <div
                className="
                  flex items-center gap-2
                  rounded-full
                  bg-white/90 backdrop-blur-md
                  border border-gray-200/80
                  shadow-lg shadow-slate-900/10
                  px-4 py-2
                  min-w-max
                "
              >
                {/* Category colour dot */}
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`}
                />

                {/* Emoji */}
                <span className="text-sm leading-none select-none">
                  {meta.emoji}
                </span>

                {/* Task label */}
                <span
                  className={`text-[13px] font-semibold leading-none ${meta.badge}`}
                >
                  {bubble.label}
                </span>

                {/* Subtle category tag */}
                <span className="text-[10px] font-medium text-slate-400 leading-none hidden sm:inline">
                  {bubble.category}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
