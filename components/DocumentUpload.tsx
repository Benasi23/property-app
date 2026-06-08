"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function DocumentUpload({ propertyId }: { propertyId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file");
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      const filePath = `${propertyId}/${Date.now()}-${file.name}`;

      // 1. Upload file
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const fileUrl = data.publicUrl;

      // 3. Save DB record
      const { error: dbError } = await supabase.from("documents").insert({
        property_id: propertyId,
        file_name: file.name,
        file_url: fileUrl,
        doc_type: "general",
      });

      if (dbError) throw dbError;

      setMessage("Upload successful");
      setFile(null);
    } catch (err: any) {
      setMessage(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Upload Documents
      </div>

      <input type="file" onChange={handleFileChange} />

      <button
        onClick={handleUpload}
        disabled={uploading}
        style={{
          marginLeft: 10,
          padding: "8px 12px",
          borderRadius: 8,
          border: "none",
          background: uploading ? "#999" : "#111",
          color: "white",
          cursor: "pointer",
        }}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>

      {message && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {message}
        </div>
      )}
    </div>
  );
}