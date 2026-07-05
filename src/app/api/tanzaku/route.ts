import { NextRequest, NextResponse } from "next/server";
import { createTanzaku, listTanzaku } from "@/lib/tanzakuStore";
import type {
  TanzakuCreateResponse,
  TanzakuListResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? "jpg";
}

export async function GET() {
  try {
    const tanzaku = await listTanzaku();
    return NextResponse.json({ tanzaku } satisfies TanzakuListResponse);
  } catch (error) {
    console.error("Failed to list tanzaku:", error);
    return NextResponse.json(
      { error: "短冊一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です(multipart/form-dataが必要です)。" },
      { status: 400 },
    );
  }

  try {
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "画像ファイル(image)が見つかりません。" },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "画像ファイルのみアップロードできます。" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "ファイルサイズが大きすぎます(上限15MB)。" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = extensionForMimeType(file.type);

    const tanzaku = await createTanzaku({ buffer, extension });

    return NextResponse.json(
      { tanzaku } satisfies TanzakuCreateResponse,
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create tanzaku:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
