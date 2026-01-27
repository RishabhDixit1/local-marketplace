"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

type Post = {
  id: string;
  text: string;
  type: "need" | "provide";
  status: "open" | "accepted";
  created_at: string;
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState<"need" | "provide">("need");

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPosts(data as Post[]);
  };

  const createPost = async () => {
    if (!text.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("posts").insert({
      text,
      type,
      status: "open",
      user_id: user.id,
    });

    setText("");
    loadPosts();
  };

  return (
    <div className="space-y-6">
      {/* CREATE CARD */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-2">
          Create a Marketplace Post
        </h2>

        <select
          className="border p-2 rounded w-full mb-2"
          value={type}
          onChange={(e) =>
            setType(e.target.value as "need" | "provide")
          }
        >
          <option value="need">I Need</option>
          <option value="provide">I Provide</option>
        </select>

        <textarea
          className="border p-2 rounded w-full mb-2"
          rows={3}
          placeholder="Example: Looking for a delivery partner near me"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          onClick={createPost}
        >
          Post
        </button>
      </div>

      {/* FEED */}
      <div className="grid gap-4 md:grid-cols-2">
        {posts.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition"
          >
            <div className="flex justify-between mb-2">
              <span
                className={`px-2 py-1 text-xs font-bold rounded-full ${
                  p.type === "need"
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {p.type.toUpperCase()}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(p.created_at).toLocaleString()}
              </span>
            </div>

            <p className="mb-3">{p.text}</p>

            <div className="flex justify-between items-center">
              <span
                className={`text-xs font-semibold ${
                  p.status === "open"
                    ? "text-yellow-600"
                    : "text-green-600"
                }`}
              >
                {p.status.toUpperCase()}
              </span>

              {p.status === "open" && (
                <button className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
