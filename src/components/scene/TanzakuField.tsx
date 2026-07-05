"use client";

import { useMemo, useState } from "react";
import { Tanzaku } from "./Tanzaku";
import { hashString, mulberry32 } from "./random";
import type { Tanzaku as TanzakuData } from "@/lib/types";

type PlacedTanzaku = {
  data: TanzakuData;
  position: [number, number, number];
  rotationSeed: number;
};

const BAMBOO_MIN_HEIGHT = 1.0; // 地面付近は避ける
const BAMBOO_MAX_HEIGHT = 6.6;
const MIN_RADIUS = 0.9;
const MAX_RADIUS = 2.1;

function computePlacement(t: TanzakuData): PlacedTanzaku {
  // id文字列のハッシュとseedを組み合わせてこの短冊専用の乱数列を作る。
  // 同じ id/seed からは毎回同じ数列が得られるため、リロードしても配置は変わらない。
  const combinedSeed = (hashString(t.id) ^ Math.floor(t.seed * 0xffffffff)) >>> 0;
  const rand = mulberry32(combinedSeed);

  const angle = rand() * Math.PI * 2;
  const height = BAMBOO_MIN_HEIGHT + rand() * (BAMBOO_MAX_HEIGHT - BAMBOO_MIN_HEIGHT);
  // 高いところほど笹の半径が細くなるので、半径もそれに合わせて少し絞る
  const heightRatio = (height - BAMBOO_MIN_HEIGHT) / (BAMBOO_MAX_HEIGHT - BAMBOO_MIN_HEIGHT);
  const radiusRange = MAX_RADIUS - (MAX_RADIUS - MIN_RADIUS) * heightRatio * 0.5;
  const radius = MIN_RADIUS + rand() * (radiusRange - MIN_RADIUS);

  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  const rotationSeed = rand() * Math.PI * 2;

  return {
    data: t,
    position: [x, height, z],
    rotationSeed,
  };
}

/**
 * 複数の短冊を笹の周りに立体的に配置する。
 * 配置(角度・高さ・半径)は id + seed から決定論的に計算するため、
 * 同じデータであればリロードしても常に同じ場所に描画される。
 */
export function TanzakuField({
  tanzaku,
  selectedId = null,
  onSelect,
}: {
  tanzaku: TanzakuData[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const placements = useMemo(
    () => tanzaku.map((t) => computePlacement(t)),
    [tanzaku]
  );

  // 「これまでの描画で見たことのあるid」を保持し、新規追加分だけ isNew=true にする。
  // 初期値には初回マウント時点の tanzaku を入れておくことで、最初の表示では
  // 全短冊が isNew=false(既存表示)となり、以降 props で追加された分だけが
  // 降ってくる演出(isNew=true)の対象になる。
  //
  // "adjusting state during render" パターン(React公式が認めている数少ない
  // レンダー中setStateの用法)を使い、前回処理した tanzaku 配列と参照が変わって
  // いたら、その場で knownIds を更新する。useEffect 経由だと反映が1レンダー
  // 遅れて isNew の判定に間に合わないため、あえてこの形にしている。
  const [knownIds, setKnownIds] = useState<ReadonlySet<string>>(
    () => new Set(tanzaku.map((t) => t.id))
  );
  const [processedTanzaku, setProcessedTanzaku] = useState(tanzaku);

  // このレンダーで isNew 判定に使う id 集合。通常は knownIds と同じだが、
  // tanzaku が変化した直後のレンダーでは、新規idを含めた集合をその場で
  // 計算して使うことで、追加された短冊が最初のフレームから isNew=true に
  // なるようにする(knownIds の state 更新の反映を待たない)。
  let idsForThisRender = knownIds;

  if (tanzaku !== processedTanzaku) {
    setProcessedTanzaku(tanzaku);
    const merged = new Set(knownIds);
    let changed = false;
    for (const t of tanzaku) {
      if (!merged.has(t.id)) {
        merged.add(t.id);
        changed = true;
      }
    }
    if (changed) {
      setKnownIds(merged);
      idsForThisRender = knownIds; // 新規idはまだ merged にしか無い = ここでは追加しない
    }
  }

  return (
    <group>
      {placements.map(({ data, position, rotationSeed }) => (
        <Tanzaku
          key={data.id}
          tanzaku={data}
          position={position}
          rotationSeed={rotationSeed}
          isNew={!idsForThisRender.has(data.id)}
          isSelected={selectedId === data.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
