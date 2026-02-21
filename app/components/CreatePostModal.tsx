"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreatePostModal({ open, onClose }: Props) {
  const [type, setType] = useState("need");
  const [urgent, setUrgent] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [budget, setBudget] = useState("");

  if (!open) return null;

  const publishPost = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return alert("Login required");

    await supabase.from("posts").insert({
      text: title + " — " + details,
      type,
      status: "open",
      user_id: user.id,
    });

    alert("Post published 🚀");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 relative"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
        >
          <X />
        </button>

        {/* Title */}
        <h2 className="text-xl font-semibold mb-5">
          Create Post
        </h2>

        {/* Type Toggle */}
        <div className="flex gap-3 mb-5">
          {["need", "service", "product"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-2 rounded-lg text-sm capitalize ${
                type === t
                  ? "bg-indigo-600"
                  : "bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Urgent */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={urgent}
            onChange={() => setUrgent(!urgent)}
          />
          <span>Mark as urgent</span>
        </div>

        {/* Title */}
        <input
          placeholder="Post title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          className="w-full mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700"
        />

        {/* Details */}
        <textarea
          placeholder="Describe your need..."
          value={details}
          onChange={(e) =>
            setDetails(e.target.value)
          }
          className="w-full mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700"
        />

        {/* Budget */}
        <input
          placeholder="Budget ₹"
          value={budget}
          onChange={(e) =>
            setBudget(e.target.value)
          }
          className="w-full mb-6 p-3 rounded-lg bg-slate-800 border border-slate-700"
        />

        {/* CTA */}
        <button
          onClick={publishPost}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 font-semibold"
        >
          Publish Post 🚀
        </button>
      </motion.div>
    </div>
  );
}