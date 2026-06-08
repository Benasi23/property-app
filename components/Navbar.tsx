"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `relative text-sm font-medium transition-all duration-200 ${
      pathname === path ? "text-black" : "text-gray-500"
    } hover:text-black`;

  return (
    <nav className="w-full bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="font-bold text-lg">PropertyApp</div>

        <div className="flex gap-6">
          <Link href="/" className={linkClass("/")}>
            Home
          </Link>

          <Link href="/reservations" className={linkClass("/reservations")}>
            Reservations
          </Link>

          <Link href="/my-leads" className={linkClass("/my-leads")}>
            My Leads
          </Link>

          <Link href="/login" className={linkClass("/login")}>
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
}