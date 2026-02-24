"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  active: string;
}

export default function DashboardLayout({ children, active }: Props) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-lg font-bold capitalize">{active}</h1>
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}