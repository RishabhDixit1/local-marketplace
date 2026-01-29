"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

type CreatePostForm = {
  title: string;
  description: string;
  location: string;
  budget?: string;
  timeline?: string;
};

export default function CreatePostPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreatePostForm>({
    title: "",
    description: "",
    location: "",
    budget: "",
    timeline: "",
  });

  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageData(null);
      setImageName(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      console.warn("Image too large (max 5MB).");
      setImageData(null);
      setImageName(null);
      return;
    }
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setImageData(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageData(null);
    setImageName(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create new post object
    const newPost = {
      id: Date.now().toString(),
      userImage:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
      userName: "Current User",
      description: formData.description,
      location: formData.location,
      timeAgo: "just now",
      image: imageData || null,
      // category removed (only "need" implied)
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
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            title="Go back"
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-200"
          >
            <ArrowLeft />
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Create a Post
          </h1>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 md:p-8 space-y-6"
        >
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

          {/* Optional Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Image (optional)
            </label>

            <div className="flex items-center gap-3">
              <label
                htmlFor="image-upload"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-semibold cursor-pointer"
              >
                Choose file
                {imageName && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500">
                    <Check size={14} className="text-white check-pop" />
                  </span>
                )}
              </label>

              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              <div className="text-sm text-gray-600 dark:text-gray-300">
                {imageName ? imageName : "No file chosen"}
              </div>

              {imageData && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="ml-auto text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>

            {imageData && (
              <img
                src={imageData}
                alt="Preview"
                className="mt-3 max-h-40 rounded-md object-cover"
              />
            )}
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
