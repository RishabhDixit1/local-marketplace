"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, MapPin, DollarSign, Clock, Tag, FileText, Sparkles } from "lucide-react";

type PostType = "need" | "provide";

interface CreatePostForm {
  type: PostType;
  title: string;
  description: string;
  tags: string[];
import { ArrowLeft, Check } from "lucide-react";

type CreatePostForm = {
  title: string;
  description: string;
  location: string;
  budget?: string;
  timeline?: string;
}

export default function CreatePostPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreatePostForm>({
    title: "",
    description: "",
    tags: [],
    location: "",
    budget: "",
    timeline: "",
  });

  const [currentTag, setCurrentTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAddTag = () => {
    const trimmedTag = currentTag.trim();
    if (trimmedTag && formData.tags.length < 10 && !formData.tags.includes(trimmedTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));
      setCurrentTag("");
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

  const handleRemoveTag = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== idx),
    }));
  const clearImage = () => {
    setImageData(null);
    setImageName(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length < 10) {
      newErrors.title = "Title must be at least 10 characters";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    } else if (formData.description.length < 20) {
      newErrors.description = "Description must be at least 20 characters";
    }

    if (formData.tags.length === 0) {
      newErrors.tags = "Add at least one tag";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newPost = {
        id: Date.now().toString(),
        userImage:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
        userName: "Current User",
        tags: formData.tags,
        title: formData.title,
        description: formData.description,
        location: formData.location,
        budget: formData.budget,
        timeline: formData.timeline,
        timeAgo: "just now",
        category: formData.type,
        createdAt: new Date().toISOString(),
      };

      // Store in localStorage
      const existingPosts = localStorage.getItem("userPosts");
      const userPosts = existingPosts ? JSON.parse(existingPosts) : [];
      userPosts.unshift(newPost);
      localStorage.setItem("userPosts", JSON.stringify(userPosts));

      // Navigate back to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating post:", error);
      setErrors({ submit: "Failed to create post. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8 lg:mb-12">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors duration-200 mb-6"
          >
            <ArrowLeft className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
          
          <div className="space-y-3">
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Create New Post
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Share your service needs or offerings with the community
            </p>
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Post Type Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              What would you like to do?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "need" })}
                className={`group relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                  formData.type === "need"
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  <Sparkles className="w-5 h-5" />
                  <span>I Need a Service</span>
                </div>
                {formData.type === "need" && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 animate-pulse" />
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "provide" })}
                className={`group relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                  formData.type === "provide"
                    ? "bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  <Sparkles className="w-5 h-5" />
                  <span>I Offer a Service</span>
                </div>
                {formData.type === "provide" && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-pink-400/20 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Main Form Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700 space-y-6">
            
            {/* Title */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                <FileText className="w-4 h-4" />
                Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 ${
                  errors.title
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500/20"
                }`}
                placeholder="e.g., Looking for an experienced plumber for kitchen renovation"
              />
              {errors.title && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
              )}
            </div>
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

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                <FileText className="w-4 h-4" />
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={5}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 resize-none ${
                  errors.description
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500/20"
                }`}
                placeholder="Provide detailed information about the service you need or offer. Include any specific requirements, experience level needed, or other relevant details..."
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {formData.description.length} characters
              </p>
            </div>

            {/* Tags/Skills */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                <Tag className="w-4 h-4" />
                Tags & Skills
              </label>
              
              {/* Tags Display */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(idx)}
                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors duration-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={formData.tags.length >= 10}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 ${
                    errors.tags
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500/20"
                  }`}
                  placeholder="e.g., Plumbing, Electrical, Carpentry"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!currentTag.trim() || formData.tags.length >= 10}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </div>
              
              {errors.tags && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.tags}</p>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {formData.tags.length}/10 tags added
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                <MapPin className="w-4 h-4" />
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 ${
                  errors.location
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500/20"
                }`}
                placeholder="e.g., Downtown Manhattan, New York"
              />
              {errors.location && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.location}</p>
              )}
            </div>

            {/* Budget and Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  <DollarSign className="w-4 h-4" />
                  Budget <span className="text-xs font-normal text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  placeholder="e.g., $500 - $1,000"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  <Clock className="w-4 h-4" />
                  Timeline <span className="text-xs font-normal text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  placeholder="e.g., Within 2 weeks"
                />
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Post...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Publish Post</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}