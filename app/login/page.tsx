"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function handleAuth() {
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
      } else {
        router.push("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(error.message);
      } else {
        alert("Check your email to confirm signup");
      }
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f7f7",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          borderRadius: 16,
          padding: 30,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        {/* HEADER */}
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Welcome to Property Portal
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginTop: 8,
            marginBottom: 25,
          }}
        >
          {mode === "login" ? "Sign in to continue" : "Create your account"}
        </p>

        {/* EMAIL */}
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {/* BUTTON */}
        <button
          onClick={handleAuth}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 15,
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: "#ff385c",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading
            ? "Loading..."
            : mode === "login"
            ? "Sign In"
            : "Sign Up"}
        </button>

        {/* SWITCH MODE */}
        <p
          style={{
            textAlign: "center",
            marginTop: 15,
            fontSize: 14,
            color: "#666",
          }}
        >
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <span
                style={{ color: "#ff385c", cursor: "pointer" }}
                onClick={() => setMode("signup")}
              >
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span
                style={{ color: "#ff385c", cursor: "pointer" }}
                onClick={() => setMode("login")}
              >
                Sign in
              </span>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: 12,
  marginTop: 10,
  borderRadius: 10,
  border: "1px solid #ddd",
};