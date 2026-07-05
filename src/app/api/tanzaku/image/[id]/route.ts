import { NextResponse } from "next/server";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const fileRef = ref(storage, id);
    const url = await getDownloadURL(fileRef);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch image from storage");

    const mimeType = res.headers.get("Content-Type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to fetch tanzaku image:", error);
    return NextResponse.json(
      { error: "画像が見つかりませんでした。" },
      { status: 404 },
    );
  }
}


