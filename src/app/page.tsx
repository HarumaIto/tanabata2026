"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TanabataScene } from "@/components/scene/Scene";
import type { Tanzaku, TanzakuListResponse } from "@/lib/types";

const POLL_INTERVAL_MS = 4000;

export default function Home() {
  const [tanzaku, setTanzaku] = useState<Tanzaku[]>([]);

  const fetchTanzaku = useCallback(async () => {
    try {
      const res = await fetch("/api/tanzaku", { cache: "no-store" });
      if (!res.ok) return;
      const data: TanzakuListResponse = await res.json();
      setTanzaku(data.tanzaku);
    } catch {
      // ネットワーク瞬断は無視し、次のポーリングで回復させる
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(fetchTanzaku, 0);
    const id = setInterval(fetchTanzaku, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [fetchTanzaku]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05061a]">
      <TanabataScene tanzaku={tanzaku} />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 sm:p-10">
        <header>
          <h1 className="text-lg font-semibold tracking-wide text-white/90 drop-shadow-[0_0_12px_rgba(255,206,140,0.5)] sm:text-2xl">
            七夕まつり
            <span className="ml-3 text-sm font-normal text-amber-200/80 sm:text-base">
              Life is Tech !
            </span>
          </h1>
        </header>

        <footer className="flex items-end justify-end gap-4">
          <p className="whitespace-nowrap text-xs text-white/40">
            {tanzaku.length} 枚の短冊が飾られています
          </p>
        </footer>
      </div>

      {/* 短冊を追加するボタン（左下） */}
      <Link
        href="/upload"
        className="group absolute bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#f4c95d] to-[#e8a13a] shadow-[0_0_24px_rgba(244,201,93,0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_32px_rgba(244,201,93,0.6)] active:scale-95 sm:bottom-10 sm:left-10 sm:h-16 sm:w-16"
        aria-label="短冊を追加する"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7 text-[#1a1030] transition-transform duration-300 group-hover:rotate-90 sm:h-8 sm:w-8"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
    </div>
  );
}
