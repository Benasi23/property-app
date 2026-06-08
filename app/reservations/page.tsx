"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function PropertyCard({ p }: { p: any }) {
  const [status, setStatus] = useState(p?.status ?? "available");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reserveProperty = async () => {
    try {
      setLoading(true);
      setError(null);

      // get logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to reserve");
      }

      // FIX: always generate expiry (NEVER NULL)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min hold

      const { error } = await supabase
        .from("properties")
        .update({
          status: "reserved",
          reserved_by: user.id,
          reserved_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(), // ✅ ALWAYS SET
        })
        .eq("id", p.id)
        .eq("status", "available");

      if (error) throw error;

      setStatus("reserved");
    } catch (err: any) {
      setError(err.message || "Reservation failed");
    } finally {
      setLoading(false);
    }
  };

  const isExpired =
    p?.expires_at && new Date(p.expires_at).getTime() < Date.now();

  const displayStatus = isExpired ? "available" : status;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        padding: 16,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* LOT */}
      <div style={{ fontWeight: 800 }}>
        Lot {p?.lot_id ?? "N/A"}
      </div>

      {/* PROJECT */}
      <div style={{ fontSize: 13, color: "#666" }}>
        Project: {p?.project_id ?? "N/A"}
      </div>

      {/* PRICE (AUD) */}
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        AUD ${Number(p?.price ?? 0).toLocaleString("en-AU")}
      </div>

      {/* STATUS */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color:
            displayStatus === "available"
              ? "green"
              : displayStatus === "reserved"
              ? "orange"
              : "red",
        }}
      >
        {displayStatus.toUpperCase()}
      </div>

      {/* EXPIRY INFO */}
      {status === "reserved" && p?.expires_at && (
        <div style={{ fontSize: 12, color: "#555" }}>
          Hold expires:{" "}
          {new Date(p.expires_at).toLocaleString("en-AU")}
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div style={{ color: "red", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* BUTTON */}
      <button
        onClick={reserveProperty}
        disabled={loading || displayStatus !== "available"}
        style={{
          padding: 10,
          borderRadius: 10,
          border: "none",
          background:
            displayStatus === "available" ? "#111" : "#ccc",
          color: "white",
          fontWeight: 700,
          cursor:
            displayStatus === "available"
              ? "pointer"
              : "not-allowed",
        }}
      >
        {loading ? "Reserving..." : "Reserve Stock"}
      </button>
    </div>
  );
}