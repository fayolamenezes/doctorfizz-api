"use client";

import { useEffect, useRef, useState } from "react";

export default function Steps({ currentStep = 1 }) {
  const steps = [
    { id: 1, label: "Add Website" },
    { id: 2, label: "Add Business" },
    { id: 3, label: "Lang & Loc" },
    { id: 4, label: "Add Keywords" },
    { id: 5, label: "Competition" },
  ];

  const wrapRef = useRef(null);
  const circleRefs = useRef([]);
  const [linePos, setLinePos] = useState({ left: 0, width: 0, top: 0 });

  // dot tuning
  const DOT_DIAM = 3.5; // dot size (px)
  const DOT_GAP = 8; // gap between dots (px)
  const BG_SIZE = `${DOT_GAP + DOT_DIAM}px ${DOT_DIAM}px`;

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const first = circleRefs.current[0];
      const last = circleRefs.current[steps.length - 1];
      if (!wrap || !first || !last) return;

      const wrapRect = wrap.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();

      const CIRCLE = 36; // w-9 h-9
      const R = CIRCLE / 2;

      const firstCenterX = firstRect.left - wrapRect.left + firstRect.width / 2;
      const lastCenterX = lastRect.left - wrapRect.left + lastRect.width / 2;

      const START_PAD = 6;
      const END_PAD = 6;

      const left = firstCenterX + R + START_PAD;
      const right = lastCenterX - R - END_PAD;
      const width = Math.max(0, right - left);

      const top =
        firstRect.top - wrapRect.top + firstRect.height / 2 - DOT_DIAM / 2;
      setLinePos({ left, width, top });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [steps.length]);

  // how far the overlay should extend
  const maxSegments = steps.length - 1;
  const progressPct =
    maxSegments > 0
      ? Math.min(Math.max((currentStep - 1) / maxSegments, 0), 1)
      : 0;

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 mb-8">
      {/* subtle entrance for the whole bar */}
      <style jsx>{`
        .pulse {
          animation: pulseDot 1.3s ease-out infinite;
        }
        @keyframes pulseDot {
          0% {
            transform: scale(1);
            opacity: 0.9;
          }
          60% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.9;
          }
        }
      `}</style>

      <div
        ref={wrapRef}
        className="relative flex items-center justify-center gap-x-10"
      >
        {/* gray base dots */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: `${linePos.left}px`,
            width: `${linePos.width}px`,
            top: `${linePos.top}px`,
            height: `${DOT_DIAM}px`,
            backgroundImage: `radial-gradient(circle, #cbd5e1 ${
              DOT_DIAM / 2
            }px, transparent ${DOT_DIAM / 2}px)`,
            backgroundSize: BG_SIZE,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "0 center",
            pointerEvents: "none",
            transition: "left 250ms ease, width 250ms ease, top 250ms ease",
          }}
        />
        {/* progress overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: `${linePos.left}px`,
            width: `${linePos.width * progressPct}px`,
            top: `${linePos.top}px`,
            height: `${DOT_DIAM}px`,
            backgroundImage: `radial-gradient(circle, #ffa615 ${
              DOT_DIAM / 2
            }px, transparent ${DOT_DIAM / 2}px)`,
            backgroundSize: BG_SIZE,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "0 center",
            pointerEvents: "none",
            transition:
              "width 600ms cubic-bezier(.2,.8,.2,1), left 250ms ease, top 250ms ease",
          }}
        />

        {steps.map((step, i) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isInactive = !isActive && !isCompleted; // future step → fade

          return (
            <div
              key={step.id}
              className="flex flex-col items-center"
              style={{ minWidth: 104 }}
            >
              {/* circle */}
              <div
                ref={(el) => (circleRefs.current[i] = el)}
                className={`flex items-center justify-center rounded-full w-9 h-9 z-10 transition-all duration-300
                  ${
                    isActive
                      ? "bg-[image:var(--infoHighlight-gradient)] text-white scale-105 shadow-sm pulse"
                      : "bg-gray-200 step-circle--inactive"
                  }
                  ${isInactive ? "opacity-50" : "opacity-100"}`}
              >
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <defs>
                      <linearGradient
                        id="infoHighlightGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#d45427" />
                        <stop offset="100%" stopColor="#ffa615" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="url(#infoHighlightGradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        strokeDasharray: 24,
                        strokeDashoffset: isCompleted ? 0 : 24,
                        transition: "stroke-dashoffset 500ms ease 120ms",
                      }}
                    />
                  </svg>
                ) : (
                  <span className="font-semibold text-sm transition-colors duration-300 text-[#303030] dark:text-white">
                    {step.id}
                  </span>
                )}
              </div>

              {/* label */}
              <span
                className={`mt-2 text-sm text-center leading-tight transition-colors duration-300
                  ${
                    isActive
                      ? "font-medium text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-300"
                  }
                  ${isInactive ? "opacity-50" : "opacity-100"}`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
