"use client";
import { FC, useState } from "react";
import { supabase } from "../lib/supabase";

interface Property {
  id: number;
  title: string;
  price: number;
  image_url?: string;
}

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: FC<PropertyCardProps> = ({ property }) => {
  const [reserving, setReserving] = useState(false);

  const handleReserve = async () => {
    setReserving(true);

    const { error } = await supabase.from("reservations").insert([
      {
        property_id: property.id,
        status: "reserved",
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days expiry
      },
    ]);

    if (error) alert("Error reserving: " + error.message);
    else alert("Property reserved successfully!");

    setReserving(false);
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        transition: "transform 0.2s ease",
        cursor: "pointer",
      }}
      onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
      onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {/* Image */}
      <div
        style={{
          height: 160,
          background: "#ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#666",
        }}
      >
        {property.image_url ? (
          <img
            src={property.image_url}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          "No Image"
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
          {property.title}
        </h2>
        <p style={{ color: "#444", fontWeight: 500 }}>
          AU${property.price.toLocaleString("en-AU")}
        </p>

        <button
          onClick={handleReserve}
          disabled={reserving}
          style={{
            marginTop: 8,
            padding: "8px 12px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            opacity: reserving ? 0.6 : 1,
          }}
        >
          {reserving ? "Reserving..." : "Reserve"}
        </button>
      </div>
    </div>
  );
};

export default PropertyCard;