"use client";

import { useCallback, useEffect, useState } from "react";
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

        <footer className="flex items-end justify-between gap-4">
          <p className="text-xs text-white/70 sm:text-sm">
            スマホで{" "}
            <span className="font-mono text-amber-200">/upload</span>{" "}
            にアクセスして、あなたの短冊を飾ろう
          </p>
          <p className="whitespace-nowrap text-xs text-white/40">
            {tanzaku.length} 枚の短冊が飾られています
          </p>
        </footer>
      </div>
    </div>
  );
}
