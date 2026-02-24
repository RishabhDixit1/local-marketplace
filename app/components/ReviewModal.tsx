"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ReviewModalProps = {
  providerId: string;
  open: boolean;
  onClose: () => void;
};

export default function ReviewModal({
  providerId,
  open,
  onClose,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] =
    useState("");

  const submitReview = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return alert("Login required");

    await supabase.from("reviews").insert({
      provider_id: providerId,
      reviewer_id: user.id,
      rating,
      comment,
    });

    alert("Review submitted ✅");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

      <div className="bg-slate-900 p-6 rounded-2xl w-80">

        <h3 className="font-semibold mb-4">
          Write Review
        </h3>

        <select
          value={rating}
          onChange={(e) =>
            setRating(Number(e.target.value))
          }
          className="w-full mb-3 p-2 rounded bg-slate-800"
        >
          {[5,4,3,2,1].map((r) => (
            <option key={r}>
              {r} Stars
            </option>
          ))}
        </select>

        <textarea
          placeholder="Write your feedback..."
          className="w-full p-2 rounded bg-slate-800 mb-3"
          value={comment}
          onChange={(e) =>
            setComment(e.target.value)
          }
        />

        <button
          onClick={submitReview}
          className="w-full bg-indigo-600 py-2 rounded"
        >
          Submit Review
        </button>
      </div>
    </div>
  );
}
