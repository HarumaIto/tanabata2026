import type { Tanzaku } from "@/lib/types";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, listAll, getMetadata } from "firebase/storage";

// 3D表示側と統一する短冊の色パレット
const TANZAKU_COLORS = [
  "#e8506b", // 赤/ピンク
  "#f4c95d", // 黄/金
  "#5fae7d", // 緑
  "#7b6fd6", // 紫
  "#4fa8d8", // 青
  "#f2ede1", // クリーム/白
] as const;

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function pickRandomColor(): string {
  const index = Math.floor(Math.random() * TANZAKU_COLORS.length);
  return TANZAKU_COLORS[index];
}

function mimeTypeForExtension(extension: string): string {
  return EXTENSION_TO_MIME[extension.toLowerCase()] ?? "image/jpeg";
}

function imageUrlFor(fileId: string): string {
  return `/api/tanzaku/image/${fileId}`;
}

export async function listTanzaku(): Promise<Tanzaku[]> {
  const listRef = ref(storage, "");
  const res = await listAll(listRef);

  const items = await Promise.all(
    res.items
      .filter((item) => item.name.startsWith("tanzaku-"))
      .map(async (itemRef) => {
        const meta = await getMetadata(itemRef);
        const customMetadata = meta.customMetadata ?? {};
        const color = customMetadata.color ?? TANZAKU_COLORS[0];
        const parsedSeed = Number(customMetadata.seed);
        const seed = Number.isFinite(parsedSeed) ? parsedSeed : Math.random();
        const createdAt = meta.timeCreated
          ? Date.parse(meta.timeCreated)
          : Date.now();

        const tanzaku: Tanzaku = {
          id: itemRef.name,
          imageUrl: imageUrlFor(itemRef.name),
          color,
          createdAt,
          seed,
        };
        return tanzaku;
      })
  );

  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createTanzaku(input: {
  buffer: Buffer;
  extension: string;
}): Promise<Tanzaku> {
  const extension = input.extension.replace(/^\.+/, "") || "jpg";
  const mimeType = mimeTypeForExtension(extension);
  const color = pickRandomColor();
  const seed = Math.random();
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const fileName = `tanzaku-${uniqueSuffix}.${extension}`;

  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, input.buffer, {
    contentType: mimeType,
    customMetadata: {
      color,
      seed: String(seed),
    },
  });

  const meta = await getMetadata(storageRef);
  const createdAt = meta.timeCreated
    ? Date.parse(meta.timeCreated)
    : Date.now();

  return {
    id: fileName,
    imageUrl: imageUrlFor(fileName),
    color,
    createdAt,
    seed,
  };
}

