"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { 
  User, 
  Briefcase, 
  Plus, 
  X, 
  Save, 
  Award,
  Clock,
  Mail,
  Phone,
  Globe,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface ProfileData {
  name: string;
  location: string;
  bio: string;
  role: string;
  services: string[];
  availability: string;
  email?: string;
  phone?: string;
  website?: string;
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    location: "",
    bio: "",
    role: "provider",
    services: [],
    availability: "available",
    email: "",
    phone: "",
    website: "",
  });

  const [serviceInput, setServiceInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (data) {
        setProfileData({
          name: data.name || "",
          location: data.location || "",
          bio: data.bio || "",
          role: data.role || "provider",
          services: data.services || [],
          availability: data.availability || "available",
          email: data.email || "",
          phone: data.phone || "",
          website: data.website || "",
        });
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateProfile = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!profileData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!profileData.location.trim()) {
      newErrors.location = "Location is required";
    }

    if (profileData.bio.trim().length < 20) {
      newErrors.bio = "Bio should be at least 20 characters";
    }

    if (profileData.services.length === 0) {
      newErrors.services = "Add at least one service or skill";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!validateProfile()) {
      return;
    }

    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) return;

    try {
      await supabase.from("profiles").upsert({
        id: userId,
        ...profileData,
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setErrors({ submit: "Failed to save profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const addService = () => {
    const trimmedService = serviceInput.trim();
    if (!trimmedService) return;
    if (profileData.services.includes(trimmedService)) {
      setErrors({ services: "Service already added" });
      return;
    }
    if (profileData.services.length >= 15) {
      setErrors({ services: "Maximum 15 services allowed" });
      return;
    }

    setProfileData((prev) => ({
      ...prev,
      services: [...prev.services, trimmedService],
    }));
    setServiceInput("");
    setErrors({ ...errors, services: "" });
  };

  const removeService = (service: string) => {
    setProfileData((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s !== service),
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addService();
    }
  };

  const availabilityOptions = [
    { value: "available", label: "Available", emoji: "🟢", color: "text-green-600" },
    { value: "busy", label: "Busy", emoji: "🟡", color: "text-yellow-600" },
    { value: "offline", label: "Offline", emoji: "🔴", color: "text-red-600" },
  ];

  const profileCompletion = Math.min(
    100,
    Math.round(
      ((profileData.name ? 15 : 0) +
        (profileData.location ? 15 : 0) +
        (profileData.bio.length >= 20 ? 20 : 0) +
        (profileData.services.length > 0 ? 20 : 0) +
        (profileData.email ? 10 : 0) +
        (profileData.phone ? 10 : 0) +
        (profileData.website ? 10 : 0))
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        
        {/* Success Message */}
        {showSuccess && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
            <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-semibold">Profile saved successfully!</span>
            </div>
          </div>
        )}

        {/* Header with Profile Completion */}
        <div className="mb-8 lg:mb-12">
          <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-3xl p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl border-4 border-white/30 shadow-xl">
                    <User className="w-10 h-10 lg:w-12 lg:h-12" />
                  </div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-bold mb-2">
                      Your Profile
                    </h1>
                    <p className="text-white/90 text-sm lg:text-base">
                      Build trust and connect with your local community
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile Completion Bar */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold">Profile Completion</span>
                  <span className="text-xl font-bold">{profileCompletion}%</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500 rounded-full"
                    style={{ width: `${profileCompletion}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Basic Information
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Full Name *
                </label>
                <input
                  name="name"
                  placeholder="John Doe"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 ${
                    errors.name
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                  }`}
                  value={profileData.name}
                  onChange={handleInputChange}
                />
                {errors.name && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Location *
                </label>
                <input
                  name="location"
                  placeholder="New York, NY"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 ${
                    errors.location
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                  }`}
                  value={profileData.location}
                  onChange={handleInputChange}
                />
                {errors.location && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Your Role
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setProfileData({ ...profileData, role: "provider" })}
                className={`relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                  profileData.role === "provider"
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <Award className="w-5 h-5" />
                  <span>Service Provider</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProfileData({ ...profileData, role: "seeker" })}
                className={`relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                  profileData.role === "seeker"
                    ? "bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <User className="w-5 h-5" />
                  <span>Looking for Services</span>
                </div>
              </button>
            </div>
          </div>

          {/* About/Bio */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                About You
              </h2>
            </div>

            <textarea
              name="bio"
              placeholder="Tell people about yourself, your experience, skills, and why they should trust you. Share what makes you unique and how you can help..."
              className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 resize-none ${
                errors.bio
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
              rows={5}
              value={profileData.bio}
              onChange={handleInputChange}
            />
            {errors.bio && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.bio}</p>
            )}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {profileData.bio.length} characters (minimum 20 characters)
            </p>
          </div>

          {/* Services/Skills */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Services & Skills
              </h2>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                placeholder="e.g., Plumbing, Web Design, Delivery"
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button
                onClick={addService}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>

            {errors.services && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errors.services}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {profileData.services.map((service, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {service}
                  <button
                    onClick={() => removeService(service)}
                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {profileData.services.length}/15 services added
            </p>
          </div>

          {/* Contact Information (Optional) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Contact Information <span className="text-sm font-normal text-slate-500">(Optional)</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  value={profileData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </label>
                <input
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  value={profileData.phone}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </label>
                <input
                  name="website"
                  type="url"
                  placeholder="www.yourwebsite.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  value={profileData.website}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6 lg:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Availability Status
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {availabilityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setProfileData({ ...profileData, availability: option.value })}
                  className={`relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                    profileData.availability === option.value
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">{option.emoji}</span>
                    <span>{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {errors.submit}
              </p>
            </div>
          )}

          {/* Save Button */}
          <div className="sticky bottom-6 z-10">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl hover:shadow-3xl hover:scale-[1.02] flex items-center justify-center gap-3"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}