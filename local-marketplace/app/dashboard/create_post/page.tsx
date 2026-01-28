"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type CreatePostForm = {
  type: "need" | "provide";
  title: string;
  description: string;
  queries: string[];
  location: string;
  budget?: string;
  timeline?: string;
};

export default function CreatePostPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreatePostForm>({
    type: "need",
    title: "",
    description: "",
    queries: [],
    location: "",
    budget: "",
    timeline: "",
  });

  const [currentQuery, setCurrentQuery] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddQuery = () => {
    if (currentQuery.trim() && formData.queries.length < 5) {
      setFormData((prev) => ({
        ...prev,
        queries: [...prev.queries, currentQuery.trim()],
      }));
      setCurrentQuery("");
    }
  };

  const handleRemoveQuery = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      queries: prev.queries.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create new post object
    const newPost = {
      id: Date.now().toString(),
      userImage:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
      userName: "Current User",
      queries: formData.queries,
      description: formData.description,
      location: formData.location,
      timeAgo: "just now",
      category: formData.type,
    };

    // Store in localStorage temporarily
    const existingPosts = localStorage.getItem("userPosts");
    const userPosts = existingPosts ? JSON.parse(existingPosts) : [];
    userPosts.unshift(newPost);
    localStorage.setItem("userPosts", JSON.stringify(userPosts));

    // Navigate back to dashboard
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen w-full p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            <ArrowLeft className="mr-2" />
            Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mt-2">
            Create a Post
          </h1>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 md:p-8 space-y-6"
        >
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              I want to:
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "need" })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                  formData.type === "need"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Need a Service
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "provide" })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                  formData.type === "provide"
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Provide a Service
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-purple-600 transition-all duration-200 text-sm"
              placeholder="e.g. Looking for a plumber"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-purple-600 transition-all duration-200 text-sm"
              rows={4}
              placeholder="Describe the service you need or provide"
            />
          </div>

          {/* Queries/Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags/Skills
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.queries.map((query, idx) => (
                <span
                  key={idx}
                  className="flex items-center bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 rounded-full px-3 py-1 text-xs font-medium"
                >
                  {query}
                  <button
                    type="button"
                    onClick={() => handleRemoveQuery(idx)}
                    className="ml-2 text-gray-400 hover:text-gray-500 transition-colors duration-200"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentQuery}
                onChange={(e) => setCurrentQuery(e.target.value)}
                className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-purple-600 transition-all duration-200 text-sm"
                placeholder="e.g. Plumbing, Electrical"
              />
              <button
                type="button"
                onClick={handleAddQuery}
                className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              >
                Add
              </button>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              required
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-purple-600 transition-all duration-200 text-sm"
              placeholder="e.g. 123 Main St, Springfield"
            />
          </div>

          {/* Budget and Timeline - Optional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Budget (optional)
              </label>
              <input
                type="text"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-purple-600 transition-all duration-200 text-sm"
                placeholder="e.g. $100 - $500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timeline (optional)
              </label>
              <input
                type="text"
                name="timeline"
                value={formData.timeline}
                onChange={handleInputChange}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-purple-600 transition-all duration-200 text-sm"
                placeholder="e.g. Within a week"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              Create Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
