"use client";

import { useEffect, useState } from "react";

export default function RemindersPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/reminders")
      .then((res) => res.json())
      .then((json) => setData(json));
  }, []);

  if (!data) {
    return <div className="p-6">Loading reminders...</div>;
  }

  const reminders = data.reminders || [];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">
        🔔 Auto Reminders
      </h1>

      <div className="space-y-3">
        {reminders.map((r: any) => (
          <div
            key={r.id}
            className="border p-3 rounded bg-white"
          >
            <div className="font-bold">{r.type}</div>
            <div className="text-sm">{r.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}