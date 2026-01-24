"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import router from "next/router";

type Post = {
  id: string;
  text: string;
  type: string;
  status: string;
  created_at: string;
};

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState("need");
  const router = useRouter();
  const searchParams = useSearchParams();


  const loadPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    setPosts(data || []);
  };

  useEffect(() => {
  const exchangeSession = async () => {
    await supabase.auth.getSession();
  };

  exchangeSession();
}, []);

useEffect(() => {
  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/");
    } else {
      loadPosts();
    }
  };

  checkUser();
}, []);


  const createPost = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !text) return;

    await supabase.from("posts").insert({
      text,
      type,
      user_id: user.id,
    });

    setText("");
    loadPosts();
  };

  const acceptJob = async (id: string) => {
    await supabase.from("posts").update({ status: "accepted" }).eq("id", id);
    loadPosts();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">Local Marketplace</h1>

      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="flex gap-2 mb-2">
          <select
            className="border p-2 rounded"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="need">I Need</option>
            <option value="provide">I Provide</option>
          </select>

          <input
            className="border p-2 rounded flex-1"
            placeholder="What do you need or provide?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <button
            className="bg-black text-white px-4 rounded"
            onClick={createPost}
          >
            Post
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {posts.map((p) => (
          <div
            key={p.id}
            className="bg-white p-4 rounded shadow flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">
                {p.type.toUpperCase()} — {p.text}
              </div>
              <div className="text-sm text-gray-500">
                Status: {p.status}
              </div>
            </div>

            {p.status === "open" && (
              <button
                className="bg-green-600 text-white px-4 py-2 rounded"
                onClick={() => acceptJob(p.id)}
              >
                Accept
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
