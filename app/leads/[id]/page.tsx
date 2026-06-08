"use client";

import { useEffect, useState } from "react";

export default function LeadDetail({ params }: any) {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetch(`/api/activities?leadId=${params.id}`)
      .then((res) => res.json())
      .then((data) => setActivities(data.activities || []));
  }, [params.id]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">
        Lead Activity Timeline
      </h1>

      <div className="space-y-3">
        {activities.map((a: any) => (
          <div
            key={a.id}
            className="border p-3 rounded bg-white"
          >
            <div className="font-semibold">{a.type}</div>
            <div className="text-sm text-gray-600">
              {a.message}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(a.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}