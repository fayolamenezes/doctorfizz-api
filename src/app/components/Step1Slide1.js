"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function Step1Slide1({ onNext, onWebsiteSubmit }) {
  const [site, setSite] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentState, setCurrentState] = useState("initial"); // initial | submitted | confirmed
  const [error, setError] = useState("");
  const [wavePhase, setWavePhase] = useState(0);
  const [isShaking, setIsShaking] = useState(true);
  const [showInput, setShowInput] = useState(true);

  const scrollRef = useRef(null);
  const tailRef = useRef(null);

  // ✅ Website validation
  const isValidWebsite = (url) => {
    const urlPattern =
      /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?(\/.*)?$/;
    return urlPattern.test(url);
  };

  /* ---------------- Hand wave animation ---------------- */
  useEffect(() => {
    if (currentState !== "initial") return;
    let waveInterval;
    let cycleTimeout;

    const startShakeCycle = () => {
      setIsShaking(true);
      setWavePhase(0);

      waveInterval = setInterval(() => {
        setWavePhase((prev) => (prev + 1) % 8);
      }, 100);

      cycleTimeout = setTimeout(() => {
        clearInterval(waveInterval);
        setIsShaking(false);
        setWavePhase(0);
        setTimeout(startShakeCycle, 1000);
      }, 800);
    };

    startShakeCycle();
    return () => {
      clearInterval(waveInterval);
      clearTimeout(cycleTimeout);
    };
  }, [currentState]);

  const getWaveRotation = () => {
    if (!isShaking) return 0;
    switch (wavePhase % 4) {
      case 1:
        return -30;
      case 3:
        return 30;
      default:
        return 0;
    }
  };

  /* ---------------- Auto-scroll ---------------- */
  useEffect(() => {
    if (tailRef.current && scrollRef.current) {
      tailRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, currentState]);

  /* ---------------- Handlers ---------------- */
  const handleSend = () => {
    if (!site.trim()) return;

    if (!isValidWebsite(site.trim())) {
      setError(
        "Please enter a valid website URL (e.g., company.com or http://company.com)"
      );
      return;
    }

    setError("");
    const displayUrl = site.trim().startsWith("http")
      ? site.trim()
      : `https://${site.trim()}`;

    setMessages([displayUrl]);
    setTimeout(() => setCurrentState("submitted"), 300);

    onWebsiteSubmit?.(site.trim());
    try {
      localStorage.setItem(
        "websiteData",
        JSON.stringify({ site: site.trim() })
      );
    } catch {}
    setSite("");
    // Hide input immediately and show Next button
    setShowInput(false);
  };

  const handleNext = () => onNext?.();
  const handleTryDifferent = () => {
    setCurrentState("initial");
    setMessages([]);
    setError("");
    setSite("");
    setShowInput(true);
  };

  return (
    <div className="w-full h-full flex flex-col bg-transparent overflow-x-hidden">
      {/* Hide scrollbar globally for the inner scroll area */}
      <style jsx global>{`
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* ---------------- Content Section ---------------- */}
      {/* flex-1 so this area fills all space above the bottom bar */}
      <div className="px-3 sm:px-4 md:px-6 flex-1 flex">
        <div className="box-border mx-auto w-full max-w-screen-sm md:max-w-[820px] rounded-2xl bg-transparent px-3 sm:px-4 md:px-6 py-0 flex-1 flex">
          <div
            ref={scrollRef}
            className="h-full w-full overflow-y-auto overflow-x-hidden no-scrollbar"
          >
            <div className="flex flex-col gap-5 sm:gap-6 md:gap-8">
              {currentState === "initial" && (
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 mt-1">
                  <div
                    className={`leading-none transition-transform ${
                      isShaking
                        ? "duration-100 ease-linear"
                        : "duration-300 ease-out"
                    }`}
                    style={{
                      fontSize: "clamp(40px, 10vw, 72px)",
                      transform: `rotate(${getWaveRotation()}deg) ${
                        isShaking && wavePhase % 2 === 1
                          ? "scale(1.06)"
                          : "scale(1)"
                      }`,
                      transformOrigin: "bottom center",
                      color: "#9ca3af",
                    }}
                    aria-hidden
                  >
                    <Image
                      src="/assets/hand.svg"
                      alt="Waving hand"
                      width={72}
                      height={72}
                      priority
                      style={{
                        width: "1.2em",
                        height: "1.2em",
                        display: "block",
                        opacity: 0.9,
                      }}
                      draggable={false}
                    />
                  </div>
                  <h2 className="text-[13px] sm:text-[15px] md:text-[16px] font-semibold text-gray-500 tracking-wide">
                    Hello!!!
                  </h2>
                </div>
              )}

              {/* COPY BLOCK — align left with input container */}
              <div className="w-full">
                <h3 className="text-[15px] sm:text-[16px] md:text-[18px] font-bold text-gray-900 mb-1.5 sm:mb-2.5">
                  Welcome, Sam!
                </h3>
                <p className="text-[12px] sm:text-[13px] md:text-[15px] text-gray-700 leading-relaxed break-words">
                  Add your first project by entering your website and I&apos;ll
                  build a live{" "}
                  <span className="font-bold text-gray-900">
                    SEO<br className="hidden sm:inline" /> dashboard
                  </span>{" "}
                  for you.
                </p>
                <p className="text-[11px] sm:text-[12px] md:text-[13px] text-gray-400 mt-2 sm:mt-3">
                  <span className="font-semibold text-gray-700">
                    For more information please Go to INFO tab
                  </span>
                </p>
              </div>

              {messages.map((msg, i) => (
                <div key={i} className="flex justify-end">
                  <div className="bg-[var(--input)] text-gray-800 rounded-2xl shadow-sm border border-gray-200 px-4 sm:px-5 py-3 my-1 text-[13px] sm:text-[14px] font-medium w-fit max-w-full sm:max-w-[440px] break-words">
                    {msg}
                  </div>
                </div>
              ))}

              {currentState === "submitted" && (
                <div className="w-full">
                  <h3 className="text-[15px] sm:text-[16px] md:text-[18px] font-bold text-gray-900 mb-1.5 sm:mb-2.5">
                    Here’s your site report — take a quick look on
                    <br /> the Info Tab.
                  </h3>
                  <p className="text-[12px] sm:text-[13px] md:text-[15px] text-gray-600 mt-1.5">
                    If not, you can also try a different URL?
                  </p>
                  <div className="mt-4 sm:mt-5 text-[12px] sm:text-[13px]">
                    <button
                      onClick={handleTryDifferent}
                      className="text-gray-500 hover:text-gray-700 font-semibold"
                    >
                      YES, Try different URL!
                    </button>
                  </div>
                </div>
              )}

              <div ref={tailRef} />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Bottom Bar ---------------- */}
      {/* flex-shrink-0 so it stays anchored to the bottom, no JS height needed */}
      <div className="flex-shrink-0 bg-transparent">
        <div className="border-t border-gray-200" />
        <div className="mx-auto w-full max-w-screen-sm md:max-w-[820px] px-3 sm:px-4 md:px-6">
          {showInput ? (
            <div className="py-4 sm:py-5 md:py-6">
              <div className="box-border mx-auto w-full">
                <div className="flex items-center rounded-full border border-gray-300 bg-white shadow-sm pl-3 sm:pl-4 pr-2 py-2">
                  <input
                    type="text"
                    placeholder="Add Site : eg: (http://company.com)"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="flex-1 bg-transparent outline-none text-[13px] sm:text-[14px] h-9 sm:h-10 text-gray-700 placeholder-gray-400"
                  />
                  <button
                    onClick={handleSend}
                    className="grid place-items-center h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-[image:var(--infoHighlight-gradient)] text-white hover:opacity-90"
                    aria-label="Submit website"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                {error && (
                  <p className="text-[11px] sm:text-[12px] text-red-500 text-center mt-2">
                    {error}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-5 md:py-6 flex flex-col items-center gap-2.5 sm:gap-3.5">
              <p className="text-[12px] sm:text-[13px] text-gray-600">
                All set? Click{" "}
                <span className="font-semibold text-gray-900">‘Next’</span> to
                continue.
              </p>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-full bg-[image:var(--infoHighlight-gradient)] px-5 sm:px-6 py-2.5 text-white hover:bg-gray-800 shadow-sm text-[13px]"
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
