"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { TanzakuCreateResponse } from "@/lib/types";

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);
      setErrorMessage(null);
      setState("idle");

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [],
  );

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setState("idle");
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile || state === "submitting") return;

    setState("submitting");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch("/api/tanzaku", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "アップロードに失敗しました。");
      }

      (await response.json()) as TanzakuCreateResponse;
      setState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "アップロードに失敗しました。",
      );
      setState("error");
    }
  }, [selectedFile, state]);

  const isSubmitting = state === "submitting";
  const isSuccess = state === "success";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e2a] via-[#101a3d] to-[#0a0e2a] relative overflow-hidden">
      {/* 戻るボタン（左上） */}
      <Link
        href="/"
        className="group absolute top-5 left-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:border-white/30 active:scale-90 sm:top-8 sm:left-8 sm:h-11 sm:w-11"
        aria-label="トップに戻る"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 text-white/80 transition-transform duration-300 group-hover:-translate-x-0.5 sm:h-5 sm:w-5"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </Link>

      {/* 星のきらめき背景 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(1.5px_1.5px_at_20px_30px,white,transparent),radial-gradient(1.5px_1.5px_at_90px_120px,white,transparent),radial-gradient(1px_1px_at_140px_60px,white,transparent),radial-gradient(1px_1px_at_180px_180px,white,transparent),radial-gradient(2px_2px_at_60px_200px,white,transparent),radial-gradient(1px_1px_at_220px_40px,white,transparent),radial-gradient(1.5px_1.5px_at_260px_140px,white,transparent),radial-gradient(1px_1px_at_10px_160px,white,transparent)] [background-size:300px_300px] animate-pulse" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#f4c95d]/10 blur-3xl" />
        <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-[#7b6fd6]/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
        {/* タイトル */}
        <header className="mb-8 text-center">
          <p className="mb-2 text-sm tracking-[0.3em] text-[#f4c95d]/80">
            TANABATA 2026
          </p>
          <h1 className="text-2xl font-bold leading-relaxed text-[#f2ede1]">
            願いを込めて、
            <br />
            短冊を飾ろう
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#c9cbe0]">
            紙に書いた短冊をスマホで撮影してアップロードすると、
            会場の3D笹に飾られます。
          </p>
        </header>

        {!isSuccess ? (
          <div className="flex flex-1 flex-col gap-6">
            {/* 画像選択エリア */}
            <label
              htmlFor="tanzaku-image"
              className="group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-[#f4c95d]/40 bg-white/5 p-4 text-center transition active:scale-[0.98] active:border-[#f4c95d]/70"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="選択した短冊のプレビュー"
                  className="h-full max-h-[320px] w-full rounded-xl object-contain"
                />
              ) : (
                <>
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4c95d]/15 text-3xl">
                    📷
                  </span>
                  <span className="text-base font-medium text-[#f2ede1]">
                    タップして短冊を撮影・選択
                  </span>
                  <span className="text-xs text-[#8f92b8]">
                    JPEG / PNG / WebP(15MBまで)
                  </span>
                </>
              )}
              <input
                ref={fileInputRef}
                id="tanzaku-image"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            {previewUrl && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="text-sm text-[#8f92b8] underline underline-offset-4 disabled:opacity-50"
              >
                別の写真を選び直す
              </button>
            )}

            {/* エラーメッセージ */}
            {state === "error" && errorMessage && (
              <div className="rounded-xl border border-[#e8506b]/40 bg-[#e8506b]/10 px-4 py-3 text-sm text-[#ffb3c1]">
                <p className="font-medium">アップロードできませんでした</p>
                <p className="mt-1 text-[#e8b6c0]">{errorMessage}</p>
              </div>
            )}

            {/* 送信ボタン */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || isSubmitting}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f4c95d] to-[#e8a13a] py-4 text-lg font-bold text-[#1a1030] shadow-lg shadow-[#f4c95d]/20 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#1a1030]/30 border-t-[#1a1030]" />
                  笹に飾っています…
                </>
              ) : (
                <>🎋 笹に飾る</>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center animate-[fadeIn_0.6s_ease-out]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#f4c95d]/15 text-5xl">
              🎋✨
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#f2ede1]">
                短冊が笹に飾られました
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#c9cbe0]">
                会場の大画面に、あなたの願いが飾られます。
                <br />
                素敵な七夕をお過ごしください。
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 w-full rounded-full border border-[#f4c95d]/50 bg-white/5 py-4 text-base font-semibold text-[#f4c95d] transition active:scale-[0.97]"
            >
              もう一枚飾る
            </button>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
