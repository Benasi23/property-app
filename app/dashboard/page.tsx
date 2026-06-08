"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div className="p-6">Loading...</div>;
  }

  const stats = data.stats;

  return (
    <div className="p-6 bg-white min-h-screen text-black">
      <h1 className="text-3xl font-bold mb-6">
        Property Sales Dashboard
      </h1>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <Card title="Enquiries" value={stats.enquiries} />
        <Card title="Reservations" value={stats.reservations} />
        <Card title="Packs Out" value={stats.packsOut} />
        <Card title="Contracts" value={stats.contracts} />
        <Card title="Settlements" value={stats.settlements} />
      </div>

      <div className="mb-8">
        <div className="text-xl font-bold">
          Revenue Pipeline
        </div>

        <div className="text-4xl mt-2 text-green-600">
          $
          {Number(
            stats.revenuePipeline
          ).toLocaleString()}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">
          Packs Currently Held
        </h2>

        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Buyer</th>
              <th className="p-2 text-left">Project</th>
              <th className="p-2 text-left">Lot</th>
              <th className="p-2 text-left">Days Held</th>
            </tr>
          </thead>

          <tbody>
            {data.agedPacks.map((lead: any) => (
              <tr key={lead.id}>
                <td className="p-2">{lead.name}</td>
                <td className="p-2">
                  {lead.project_name}
                </td>
                <td className="p-2">
                  {lead.lot_number}
                </td>
                <td className="p-2 font-bold">
                  {lead.daysHeld}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="border rounded p-4 shadow">
      <div className="text-sm text-gray-500">
        {title}
      </div>

      <div className="text-3xl font-bold">
        {value}
      </div>
    </div>
  );
}