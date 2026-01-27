"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState("provider");
  const [services, setServices] = useState<string[]>([]);
  const [availability, setAvailability] = useState("available");
  const [serviceInput, setServiceInput] = useState("");

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
        setName(data.name || "");
        setLocation(data.location || "");
        setBio(data.bio || "");
        setRole(data.role || "provider");
        setServices(data.services || []);
        setAvailability(data.availability || "available");
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const saveProfile = async () => {
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) return;

    await supabase.from("profiles").upsert({
      id: userId,
      name,
      location,
      bio,
      role,
      services,
      availability,
    });

    setSaving(false);
    alert("Profile saved successfully!");
  };

  const addService = () => {
    if (!serviceInput.trim()) return;
    if (services.includes(serviceInput.trim())) return;
    setServices([...services, serviceInput.trim()]);
    setServiceInput("");
  };

  const removeService = (service: string) => {
    setServices(services.filter((s) => s !== service));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading Profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl p-6 shadow-lg mb-6">
        <h1 className="text-2xl font-bold">Your Public Profile</h1>
        <p className="text-sm opacity-90">
          This is how people in your area will see and trust you
        </p>
      </div>

      {/* Main Card */}
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="font-semibold mb-2">Basic Information</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              placeholder="Full Name"
              className="border rounded p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Location (Area / City)"
              className="border rounded p-2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <h2 className="font-semibold mb-2">Role</h2>
          <select
            className="border rounded p-2 w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="provider">Service Provider</option>
            <option value="seeker">Looking for Services</option>
          </select>
        </div>

        {/* Bio */}
        <div>
          <h2 className="font-semibold mb-2">About You</h2>
          <textarea
            placeholder="Tell people what you do, your experience, and why they should trust you..."
            className="border rounded p-2 w-full min-h-[100px]"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        {/* Services */}
        <div>
          <h2 className="font-semibold mb-2">Services / Skills</h2>
          <div className="flex gap-2 mb-2">
            <input
              placeholder="Add a skill (e.g. Plumber, Delivery)"
              className="border rounded p-2 flex-1"
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
            />
            <button
              className="bg-indigo-600 text-white px-4 rounded"
              onClick={addService}
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <span
                key={service}
                className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                {service}
                <button
                  className="text-red-500"
                  onClick={() => removeService(service)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Availability */}
        <div>
          <h2 className="font-semibold mb-2">Availability</h2>
          <select
            className="border rounded p-2 w-full"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="available">🟢 Available</option>
            <option value="busy">🟡 Busy</option>
            <option value="offline">🔴 Offline</option>
          </select>
        </div>

        {/* Save */}
        <div className="pt-4">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
