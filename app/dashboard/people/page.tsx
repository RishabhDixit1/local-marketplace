"use client";

import { useState } from "react";

type Person = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  description: string;
  distance: string;
  rating: number;
  reviews: number;
  verified?: boolean;
  online?: boolean;
};

const people: Person[] = [
  {
    id: "1",
    name: "John Carter",
    avatar: "https://i.pravatar.cc/100?img=12",
    role: "Electrician • Service Provider",
    description:
      "Licensed electrician specializing in AC repair and installation.",
    distance: "1.2 km away",
    rating: 4.8,
    reviews: 45,
    verified: true,
  },
  {
    id: "2",
    name: "Samantha Lee",
    avatar: "https://i.pravatar.cc/100?img=32",
    role: "Freelance Writer",
    description: "Blog content writer & copyeditor. Fast turnaround.",
    distance: "800 m away",
    rating: 5.0,
    reviews: 50,
    online: true,
  },
  {
    id: "3",
    name: "Rahul Verma",
    avatar: "https://i.pravatar.cc/100?img=15",
    role: "Plumber • Service Provider",
    description: "Expert in leakage repair, bathroom fittings & pipelines.",
    distance: "600 m away",
    rating: 4.6,
    reviews: 32,
    verified: true,
    online: true,
  },
  {
    id: "4",
    name: "Anita Sharma",
    avatar: "https://i.pravatar.cc/100?img=47",
    role: "Home Tutor • Mathematics",
    description: "Class 6–10 math tutor with 8+ years of experience.",
    distance: "2.5 km away",
    rating: 4.9,
    reviews: 64,
    verified: true,
  },
  {
    id: "5",
    name: "Mohit Khan",
    avatar: "https://i.pravatar.cc/100?img=22",
    role: "Photographer",
    description: "Wedding & event photographer. Cinematic shots guaranteed.",
    distance: "4.1 km away",
    rating: 4.7,
    reviews: 89,
  },
  {
    id: "6",
    name: "Pooja Mehta",
    avatar: "https://i.pravatar.cc/100?img=56",
    role: "Boutique Tailor",
    description: "Custom stitching, alterations & designer blouses.",
    distance: "900 m away",
    rating: 4.5,
    reviews: 27,
    online: true,
  },
  {
    id: "7",
    name: "Amit Singh",
    avatar: "https://i.pravatar.cc/100?img=9",
    role: "Grocery Store Owner",
    description: "Daily essentials with 30-min home delivery.",
    distance: "300 m away",
    rating: 4.4,
    reviews: 112,
    verified: true,
    online: true,
  },
  {
    id: "8",
    name: "Neha Kapoor",
    avatar: "https://i.pravatar.cc/100?img=41",
    role: "Makeup Artist",
    description: "Party, bridal & photoshoot makeup specialist.",
    distance: "3.8 km away",
    rating: 4.9,
    reviews: 76,
  },
];

const TABS = ["All", "Nearby", "Active Now", "Verified"] as const;

export default function PeoplePage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");

  const filteredPeople = people
    // 🔍 Search filter
    .filter((person) =>
      `${person.name} ${person.role} ${person.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    // 🏷️ Tab filter
    .filter((person) => {
      if (activeTab === "All") return true;
      if (activeTab === "Verified") return person.verified;
      if (activeTab === "Active Now") return person.online;
      if (activeTab === "Nearby") {
        const km = parseFloat(person.distance);
        return km <= 1;
      }
      return true;
    });

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 p-6 text-white shadow">
        <h1 className="text-2xl font-bold">People Near You</h1>
        <p className="mt-1 text-white/80">
          Connect with buyers, sellers, and service providers in your area
        </p>

        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <p className="font-semibold text-lg">198</p>
            <p className="text-white/70">People Nearby</p>
          </div>
          <div>
            <p className="font-semibold text-lg">28</p>
            <p className="text-white/70">Active Now</p>
          </div>
          <div>
            <p className="font-semibold text-lg">4.7 ⭐</p>
            <p className="text-white/70">Avg Rating</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search people by name, skill, service, or area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
        />

        <select className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none">
          <option>1 km</option>
          <option>5 km</option>
          <option>10 km</option>
        </select>

        <select className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none">
          <option>Nearest</option>
          <option>Top Rated</option>
          <option>Recently Active</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-1.5 text-sm transition
              ${
                activeTab === tab
                  ? "bg-purple-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-purple-600 hover:text-white"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* People Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredPeople.map((person) => (
          <div key={person.id} className="rounded-xl bg-neutral-900 p-4 shadow">
            <div className="flex items-start gap-4">
              <img
                src={person.avatar}
                alt={person.name}
                className="h-14 w-14 rounded-full object-cover"
              />

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">
                    {person.name}
                    {person.verified && (
                      <span className="ml-2 text-green-400 text-xs">
                        ● Verified
                      </span>
                    )}
                    {person.online && (
                      <span className="ml-2 text-green-400 text-xs">
                        ● Online
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-neutral-400">
                    {person.distance}
                  </span>
                </div>

                <p className="text-sm text-neutral-400">{person.role}</p>

                <p className="mt-1 text-sm text-neutral-500 line-clamp-2">
                  {person.description}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-neutral-400">
                    ⭐ {person.rating}{" "}
                    <span className="text-neutral-500">({person.reviews})</span>
                  </div>

                  <div className="flex gap-2">
                    <button className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700">
                      Chat
                    </button>
                    <button className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-500">
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredPeople.length === 0 && (
          <div className="col-span-full text-center text-neutral-500">
            No people found
          </div>
        )}
      </div>
    </div>
  );
}
