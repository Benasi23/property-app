"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import PropertyCard from "../components/PropertyCard";

interface Property {
  id: number;
  title: string;
  price: number;
  image_url?: string;
}

export default function Home() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("id", { ascending: true });

      if (error) console.error(error);
      else setProperties(data || []);

      setLoading(false);
    };

    fetchProperties();
  }, []);

  return (
    <main style={{ padding: 32, background: "#f7f7f7", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24 }}>
        Property Portal
      </h1>

      {loading && <p>Loading properties...</p>}
      {!loading && properties.length === 0 && <p>No properties available.</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        {properties.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </main>
  );
}