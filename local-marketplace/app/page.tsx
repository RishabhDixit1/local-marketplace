"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  const login = async () => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "http://localhost:3000/dashboard"
    }
  });

  if (!error) {
    alert("Check your email for the login link");
  } else {
    alert(error.message);
  }
};

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <div style={{
        width: 300,
        padding: 20,
        border: "1px solid #ccc",
        borderRadius: 8
      }}>
        <h2>Local Marketplace Login</h2>

        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />

        <button
          onClick={login}
          style={{
            width: "100%",
            padding: 10,
            background: "black",
            color: "white",
            border: "none"
          }}
        >
          Send Login Link
        </button>
      </div>
    </div>
  );
}
