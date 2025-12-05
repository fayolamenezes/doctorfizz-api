"use client";

import React from "react";
import { LayoutDashboard, Activity, Link2, LineChart, BarChart2, ArrowUpCircle, User } from "lucide-react";

export default function CESidebar() {
  const Item = ({ icon: Icon, label, active=false, disabled=false }) => {
    const base = "flex flex-col items-center gap-1 w-full py-3 text-[11px]";
    const state = disabled
      ? "text-gray-400 cursor-not-allowed"
      : active
      ? "text-[var(--text-primary)] font-semibold"
      : "text-[var(--muted)] hover:bg-[var(--input)]";
    return (
      <button className={`${base} ${state}`} disabled={disabled} title={label}>
        <Icon size={18} />
        <span className="leading-none">{label}</span>
      </button>
    );
  };

  return (
    <aside className="border-r border-[var(--border)] bg-white/70 backdrop-blur-md">
      <div className="flex flex-col items-center gap-1 w-[56px] min-h-screen pt-3">
        <div className="h-12 w-12 rounded-full bg-[#0f172a] text-white grid place-items-center text-xs font-semibold mb-1">Logo</div>

        <Item icon={LayoutDashboard} label="Dashboard" active />
        <Item icon={Activity} label="Site Health" disabled />
        <Item icon={Link2} label="Backlinks" disabled />
        <Item icon={LineChart} label={"Comp\nanalysis"} disabled />
        <Item icon={BarChart2} label="Reports" disabled />

        <div className="mt-auto mb-2" />
        <div className="my-3 text-center">
          <div className="inline-flex items-center justify-center h-6 w-6 text-orange-500"><ArrowUpCircle size={18} /></div>
          <div className="text-[11px] text-orange-500">Upgrade</div>
        </div>
        <div className="mb-4">
          <div className="h-8 w-8 rounded-full bg-orange-500 text-white grid place-items-center text-xs font-semibold"><User size={16} /></div>
          <div className="text-[11px] text-[var(--muted)] text-center">Profile</div>
        </div>
      </div>
    </aside>
  );
}