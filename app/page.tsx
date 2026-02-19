"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const login = async () => {
    if (!email) return;

    setLoading(true);

    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:3000/dashboard",
      },
    });

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center px-6">
      {/* Floating Glow Orbs */}
      <div className="absolute w-72 h-72 bg-pink-400/30 rounded-full blur-3xl top-10 left-10 animate-pulse" />
      <div className="absolute w-72 h-72 bg-indigo-400/30 rounded-full blur-3xl bottom-10 right-10 animate-pulse" />

      <div className="relative max-w-5xl w-full grid md:grid-cols-2 gap-8 items-center">
        {/* LEFT */}
        <div className="text-white space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Find Local Services.
            <br />
            <span className="text-yellow-300">In Real Time.</span>
          </h1>

          <p className="text-lg text-white/90">
            A social marketplace for your neighborhood.  
            Post what you need — connect instantly with nearby providers.
          </p>

          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-sm">
              ⚡ Real-Time Matching
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-sm">
              🧑‍🤝‍🧑 Community Driven
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-sm">
              📍 Location Based
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Join Your Local Network</h2>
            <p className="text-gray-500 text-sm">
              Login as a seeker or provider — same account, endless opportunities
            </p>
          </div>

          {!sent ? (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                onClick={login}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:scale-[1.02] transition-transform shadow-lg"
              >
                {loading ? "Sending Secure Link..." : "Send Login Link"}
              </button>

              <p className="text-xs text-gray-500 text-center">
                We use passwordless login for maximum security
              </p>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-green-600 text-3xl">✅</div>
              <h3 className="text-lg font-semibold">Check Your Email</h3>
              <p className="text-gray-500 text-sm">
                We sent a secure login link to:
                <br />
                <span className="font-medium">{email}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-white/70 text-xs">
        Built for local communities • Powered by Supabase & Next.js
      </div>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
