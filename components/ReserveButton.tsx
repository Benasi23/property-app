"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ReserveButton({
  propertyId,
}: {
  propertyId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [reserved, setReserved] = useState(false);

  const handleReserve = async () => {
    setLoading(true);

    const userId = "demo-user"; // later replaced with real login

    const { error } = await supabase.from("reservations").insert({
      user_id: userId,
      lot_id: propertyId,
      project_id: propertyId,
      status: "pending",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h hold
    });

    if (error) {
      console.error("Reservation error:", error.message);
      setLoading(false);
      return;
    }

    setReserved(true);
    setLoading(false);
  };

  if (reserved) {
    return (
      <div style={{ color: "green", fontWeight: 600 }}>
        Reserved (Pending Approval)
      </div>
    );
  }

  return (
    <button
      onClick={handleReserve}
      disabled={loading}
      style={{
        marginTop: 10,
        padding: "10px 14px",
        background: "#111",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        width: "100%",
        fontWeight: 600,
      }}
    >
      {loading ? "Reserving..." : "Reserve Stock"}
    </button>
  );
}