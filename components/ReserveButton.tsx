"use client";

export default function ReserveButton() {
  const handleReserve = () => {
    console.log("Reserve clicked");
  };

  return (
    <button
      onClick={handleReserve}
      style={{
        padding: "10px 16px",
        backgroundColor: "#000",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      Reserve
    </button>
  );
}