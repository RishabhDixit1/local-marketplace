"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, MapPin, Clock, Plus } from "lucide-react";
import Image from "next/image";


type Post = {
  id: string;
  userImage: string;
  userName: string;
  queries: string[];
  description: string;
  location: string;
  timeAgo: string;
};

// Sample data (fallback / demo)
const SAMPLE_POSTS: Post[] = [
  {
    id: "1",
    userImage:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    userName: "John Doe",
    queries: ["Carpet Laying", "Interior Design"],
    description:
      "Looking for professional carpet laying services for my living room and bedroom.",
    location: "Downtown, City",
    timeAgo: "2 hours ago",
  },
  {
    id: "2",
    userImage:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    userName: "Sarah Smith",
    queries: ["Plumbing", "Leak Repair"],
    description:
      "Need a skilled plumber to fix leaks in the bathroom and kitchen.",
    location: "Midtown, City",
    timeAgo: "4 hours ago",
  },
  {
    id: "3",
    userImage:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
    userName: "Mike Johnson",
    queries: ["Electrical Work", "Wiring"],
    description:
      "Professional electrician offering rewiring and installation services.",
    location: "North District, City",
    timeAgo: "6 hours ago",
  },
  {
    id: "4",
    userImage:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
    userName: "Emma Wilson",
    queries: ["House Cleaning", "Deep Clean"],
    description:
      "Looking for reliable house cleaning service for weekly maintenance.",
    location: "South End, City",
    timeAgo: "1 day ago",
  },
  {
    id: "5",
    userImage:
      "https://images.unsplash.com/photo-1507527173864-658ba7c44d8a?w=150&h=150&fit=crop",
    userName: "Alex Brown",
    queries: ["Painting", "Home Renovation"],
    description:
      "Expert painter providing interior and exterior painting services.",
    location: "West Side, City",
    timeAgo: "1 day ago",
  },
  {
    id: "6",
    userImage:
      "https://images.unsplash.com/photo-1517046220202-51e0b8b0e3c9?w=150&h=150&fit=crop",
    userName: "Lisa Chen",
    queries: ["Gardening", "Landscaping"],
    description: "Need help with garden design and landscaping for backyard.",
    location: "East Park, City",
    timeAgo: "2 days ago",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>(SAMPLE_POSTS);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [acceptedPostIds, setAcceptedPostIds] = useState<string[]>([]);

  // ✅ Correct state initialization (no useEffect, no warnings)
  const [posts] = useState<Post[]>(() => {
    if (typeof window === "undefined") return SAMPLE_POSTS;

    const userPosts = localStorage.getItem("userPosts");
    if (!userPosts) return SAMPLE_POSTS;

    try {
      const parsedUserPosts: Post[] = JSON.parse(userPosts);
      return [...parsedUserPosts, ...SAMPLE_POSTS];
    } catch {
      return SAMPLE_POSTS;
    }
  });

  const handleMessage = (postId: string) => {
    console.log("Message clicked for post:", postId);
  };

  const handleAccept = (postId: string) => {
    if (!acceptedPostIds.includes(postId)) {
      setAcceptedPostIds((prev) => [...prev, postId]);
      console.log("Accepted post:", postId);
    }
  };

  const handleCreatePost = () => {
    router.push("/dashboard/create_post");
  };

  return (
    <div className="min-h-screen w-full p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
<div className="mb-12 text-center animate-fade-in-up">
  <h1 className="text-5xl md:text-6xl font-extrabold 
                 text-black-900 dark:text-black
                 mb-4 tracking-tight">
    Marketplace
  </h1>

  <p className="text-lg md:text-xl 
              text-black dark:text-gray-300 
              max-w-2xl mx-auto">
  Find services you need or offer your skills to the community
</p>

</div>


        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-gray-50 dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-purple-500 flex items-center p-4 md:p-6 gap-4"
            >
              {/* User Image */}
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-300 dark:border-slate-700">
  <Image
    src={post.userImage}
    alt={post.userName}
    fill
    sizes="80px"
    className="object-cover"
  />
</div>


              {/* Content */}
              <div className="flex-1 flex flex-col">
                <span
                  className={`mb-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full w-fit ${
                    post.category === "need"
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {post.category.toUpperCase()}
                </span>

                <h2 className="text-base font-bold truncate">
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                {/* User Name */}
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1 truncate">
                  {post.userName}
                </h2>

                <div className="flex flex-wrap gap-1 my-2">
                  {post.queries.slice(0, 2).map((query) => (
                    <span
                      key={query}
                      className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded"
                    >
                      {query}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                  {post.description}
                </p>

                <div className="flex gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {post.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {post.timeAgo}
                  </span>
                </div>

                <button
                  onClick={() => handleMessage(post.id)}
                  className="mt-auto w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <MessageCircle size={14} /> Connect
                </button>
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMessage(post.id)}
                    className="flex-1 text-sm font-semibold py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-xs border border-indigo-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-200 bg-transparent hover:bg-indigo-50 dark:hover:bg-slate-800"
                  >
                    <MessageCircle size={14} />
                    Connect
                  </button>

                  <button
                    onClick={() => handleAccept(post.id)}
                    disabled={acceptedPostIds.includes(post.id)}
                    className={`flex-1 text-sm font-semibold py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${acceptedPostIds.includes(post.id) ? "bg-indigo-300 text-white opacity-70 cursor-not-allowed" : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"}`}
                  >
                    {acceptedPostIds.includes(post.id) ? "Accepted" : "Accept"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Button */}
      <button
        onClick={handleCreatePost}
        className="fixed bottom-8 right-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full px-6 py-4 shadow-lg flex items-center gap-2"
      >
        <Plus size={20} />
        <span className="text-sm font-semibold">Create Post</span>
      </button>
    </div>
  );
}
