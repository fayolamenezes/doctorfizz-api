"use client";

import {
  BarChart2,
  PlusSquare,
  Clock,
  Grid,
  LayoutDashboard,
  Activity,
  Link2,
  LineChart,
} from "lucide-react";

function NavItem({ id, label, Icon, onClick, active = false, disabled = false }) {
  return (
    <button
      id={id}
      onClick={disabled ? undefined : onClick}
      type="button"
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled}
      className={`group relative w-full mb-6 flex flex-col items-center gap-1 outline-none
                  text-[#000000] dark:text-[#000000]
                  ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {/* Icon */}
      <span
        className={`grid place-items-center h-9 w-9 md:h-10 md:w-10 transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-40 group-hover:opacity-100"
        }`}
      >
        {/* Use class-based sizing so it scales per breakpoint */}
        <Icon className="text-[#000000] h-[20px] w-[20px] md:h-[22px] md:w-[22px] lg:h-[26px] lg:w-[26px]" />
      </span>

      {/* Label */}
      <span
        className={`leading-none mt-1 text-[#000000] transition-opacity duration-200
                    text-[10px] md:text-[12px] lg:text-[14px] ${
                      active ? "opacity-100" : "opacity-40 group-hover:opacity-100"
                    }`}
      >
        {label}
      </span>
    </button>
  );
}

export default function Sidebar({
  onInfoClick,
  infoActive = false,
  variant = "default", // "default" | "editor"
}) {
  return (
    <aside
      className="fixed left-0 top-0 h-full
                 w-[56px] md:w-[72px] lg:w-[80px]
                 bg-[image:var(--sidebar-gradient)] dark:bg-[image:var(--sidebar-gradient)]
                 flex flex-col items-center py-5 md:py-6 z-50"
    >
      {/* Logo */}
      <div className="pt-1.5 pb-4 md:pt-2 md:pb-5">
        <div className="round-circle rounded-full bg-transparent flex border-6 border-zinc-950">
          <div className="rounded-full bg-[#111827] flex justify-center items-center place-items-center p-4 m-1"></div>
        </div>
      </div>

      {/* Menu */}
      <nav className="w-full px-1.5 md:px-2">
        {variant === "default" ? (
          <>
            <NavItem
              id="sidebar-info-btn"
              onClick={onInfoClick}
              label="Info"
              Icon={BarChart2}
              active={infoActive}
            />
            <NavItem label="New" Icon={PlusSquare} />
            <NavItem label="History" Icon={Clock} />

            {/* divider */}
            <div className="mx-2 md:mx-3 my-5 md:my-6 h-px bg-[#e6e9ec] dark:bg-[#374151]" />

            <NavItem label="Others" Icon={Grid} />
          </>
        ) : (
          // editor variant
          <>
            <NavItem
              label="Dashboard"
              Icon={LayoutDashboard}
              active
              onClick={() => {
                // Tell the app to go back to the dashboard view
                try { window.dispatchEvent(new Event("content-editor:back")); } catch {}
              }}
            />
            <NavItem label="Site Health" Icon={Activity} disabled />
            <NavItem label="Backlinks" Icon={Link2} disabled />
            <NavItem label="Comp analysis" Icon={LineChart} disabled />
            <NavItem label="Reports" Icon={BarChart2} disabled />
          </>
        )}
      </nav>

      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="w-full pb-5 md:pb-6 flex flex-col items-center">
        {/* Upgrade with hover animation */}
        <div className="flex flex-col items-center mb-3 md:mb-4 text-[#000] cursor-pointer group select-none">
          <div
            className="text-xl md:text-2xl leading-none
                       transform transition-transform duration-300
                       group-hover:-translate-y-1 group-hover:scale-y-125 group-hover:scale-x-110"
          >
            ↑
          </div>
          <div className="text-[12px] md:text-[14px] font-medium">Upgrade</div>
        </div>

        {/* Profile – theme aware + invert on hover */}
        <button
          type="button"
          aria-label="Open profile"
          className="group flex flex-col items-center cursor-pointer outline-none"
        >
          <span
            className={[
              "h-10 w-10 md:h-11 md:w-11 rounded-full grid place-items-center shadow-md",
              "transition-colors duration-300",
              "bg-[#000] dark:bg-[#000]",
              "group-hover:bg-[#000] dark:group-hover:bg-[#000]",
              "focus-visible:ring-2 focus-visible:ring-red-500",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              "dark:focus-visible:ring-offset-[#1f2121]",
            ].join(" ")}
          >
            <span className="h-4 w-4 md:h-5 md:w-5 rounded-full bg-white" />
          </span>

          <span
            className="mt-2 text-[12px] md:text-[14px] text-[#6B7280]
                       transition-colors duration-200
                       group-hover:text-[#000] dark:group-hover:text-[#000]"
          >
            Profile
          </span>
        </button>
      </div>
    </aside>
  );
}
