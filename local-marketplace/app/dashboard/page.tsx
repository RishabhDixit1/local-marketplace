"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, MapPin, Clock, Plus } from "lucide-react";

type Post = {
  id: string;
  userImage: string;
  userName: string;
  queries: string[];
  description: string;
  location: string;
  timeAgo: string;
};

// Sample data - replace with actual data from Supabase
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

  useEffect(() => {
    // Fetch user created posts from localStorage
    const userPosts = localStorage.getItem("userPosts");
    if (userPosts) {
      const parsedUserPosts = JSON.parse(userPosts);
      setPosts([...parsedUserPosts, ...SAMPLE_POSTS]);
    }
  }, []);

  const handleMessage = (postId: string) => {
    setSelectedPostId(postId);
    console.log("Message clicked for post:", postId);
  };

  const handleCreatePost = () => {
    router.push("/dashboard/create_post");
  };

  return (
    <div className="min-h-screen w-full p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3">
            Marketplace
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
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
              {/* User Image - Circular */}
              <div className="flex-shrink-0 w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-800 overflow-hidden border-2 border-gray-300 dark:border-slate-700">
                <img
                  src={post.userImage}
                  alt={post.userName}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                {/* User Name */}
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1 truncate">
                  {post.userName}
                </h2>

                {/* Queries/Tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {post.queries.slice(0, 2).map((query, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 rounded font-medium"
                    >
                      {query}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-300 text-xs mb-2 line-clamp-2">
                  {post.description}
                </p>

                {/* Location and Time */}
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <div className="flex items-center gap-1">
                    <MapPin size={12} />
                    <span className="truncate">{post.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{post.timeAgo}</span>
                  </div>
                </div>

                {/* Message Button */}
                <button
                  onClick={() => handleMessage(post.id)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-indigo-700 dark:to-purple-700 dark:hover:from-indigo-800 dark:hover:to-purple-800 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-xs"
                >
                  <MessageCircle size={14} />
                  Connect
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageCircle
              size={56}
              className="text-gray-300 dark:text-gray-600 mb-4"
            />
            <p className="text-gray-600 dark:text-gray-300 text-xl font-medium">
              No posts available yet
            </p>
          </div>
        )}
      </div>

      {/* Floating Create Post Button */}
      <button
        onClick={handleCreatePost}
        className="fixed bottom-8 right-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full px-6 py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Plus size={20} />
        <span className="text-sm font-semibold">Create Post</span>
      </button>
    </div>
  );
}
