"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Tanzaku as TanzakuData } from "@/lib/types";

export type TanzakuProps = {
  tanzaku: TanzakuData;
  position: [number, number, number];
  rotationSeed: number;
  isNew?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
};

const WIDTH = 0.55;
const HEIGHT = 1.1;
const STRING_LENGTH = 0.5;

// ポップアップ時のカメラからの距離とスケール倍率
const FOCUS_DISTANCE = 4.0;
const FOCUS_SCALE_MULTIPLIER = 2.7;
// 位置/回転/スケールの指数減衰補間の速さ
const FOCUS_LERP_SPEED = 6;

/**
 * 画像読み込みが失敗しても他の短冊に影響しないようにする簡易 Error Boundary。
 */
class TextureErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // 個別短冊の読み込み失敗はログのみ、全体は止めない
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

type PointerHandlers = {
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
};

function TanzakuPaperTextured({
  imageUrl,
  color,
  isSelected,
  onPointerDown,
  onPointerUp,
}: {
  imageUrl: string;
  color: string;
  isSelected: boolean;
} & PointerHandlers) {
  const texture = useTexture(imageUrl);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    // 拡大表示時に読みやすくするため anisotropy を上げる。
    // (useTexture の戻り値を直接書き換えず、マテリアル経由でmapを参照して更新する)
    const material = materialRef.current;
    const map = material?.map;
    if (isSelected && map) {
      map.anisotropy = 16;
      map.needsUpdate = true;
    }
  }, [isSelected]);

  return (
    <>
      {/* 表面: 願い事の写真 */}
      <mesh position={[0, 0, 0.006]} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial
          ref={materialRef}
          map={texture}
          side={THREE.FrontSide}
          roughness={0.85}
          metalness={0}
          emissive={isSelected ? "#ffffff" : "#000000"}
          emissiveMap={texture}
        />
      </mesh>
      {/* 裏面: 和紙っぽい色紙 */}
      <mesh position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </mesh>
    </>
  );
}

function TanzakuPaperFallback({
  color,
  onPointerDown,
  onPointerUp,
}: { color: string } & PointerHandlers) {
  // 画像がまだ無い/失敗した場合は色紙のみの短冊として表示
  return (
    <>
      <mesh position={[0, 0, 0.006]} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </>
  );
}

function TanzakuPaper({
  imageUrl,
  color,
  isSelected,
  onPointerDown,
  onPointerUp,
}: {
  imageUrl: string;
  color: string;
  isSelected: boolean;
} & PointerHandlers) {
  return (
    <TextureErrorBoundary
      fallback={
        <TanzakuPaperFallback
          color={color}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />
      }
    >
      <Suspense
        fallback={
          <TanzakuPaperFallback
            color={color}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          />
        }
      >
        <TanzakuPaperTextured
          imageUrl={imageUrl}
          color={color}
          isSelected={isSelected}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />
      </Suspense>
    </TextureErrorBoundary>
  );
}

export function Tanzaku({
  tanzaku,
  position,
  rotationSeed,
  isNew = false,
  isSelected = false,
  onSelect,
}: TanzakuProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const focusRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const [introDone, setIntroDone] = useState(!isNew);
  const { camera } = useThree();

  // 選択が解除された後も、元の位置に滑らかに戻るまでは補間を続ける必要があるため、
  // 「現在どれだけフォーカスに寄っているか」を 0(通常)〜1(完全にフォーカス)の
  // 連続値として保持する(useFrame内でのみ読み書きするのでrefでよい)。
  const focusAmountRef = useRef(0);

  const phase = tanzaku.seed * Math.PI * 2 + rotationSeed;
  const swaySpeed = 0.6 + (tanzaku.seed % 0.5);

  const introStart = useMemo(() => position[1] + 1.6, [position]);

  // useFrame内で使い回すワークオブジェクト(毎フレームのnew allocationを避ける)。
  // 「フレームごとに書き換える可変な入れ物」なので useMemo ではなく useRef で保持する
  // (react-hooks/immutability: useMemoの戻り値をuseFrame内で書き換えるのはNG)。
  const workRef = useRef<{
    targetWorldPos: THREE.Vector3;
    targetWorldQuat: THREE.Quaternion;
    camDir: THREE.Vector3;
    parentWorldPos: THREE.Vector3;
    parentWorldQuat: THREE.Quaternion;
    parentWorldQuatInverse: THREE.Quaternion;
    parentWorldScale: THREE.Vector3;
    localTargetPos: THREE.Vector3;
    localTargetQuat: THREE.Quaternion;
    relativeTargetPos: THREE.Vector3;
    lerpedPos: THREE.Vector3;
    lerpedQuat: THREE.Quaternion;
    restQuat: THREE.Quaternion;
  } | null>(null);
  if (workRef.current === null) {
    workRef.current = {
      targetWorldPos: new THREE.Vector3(),
      targetWorldQuat: new THREE.Quaternion(),
      camDir: new THREE.Vector3(),
      parentWorldPos: new THREE.Vector3(),
      parentWorldQuat: new THREE.Quaternion(),
      parentWorldQuatInverse: new THREE.Quaternion(),
      parentWorldScale: new THREE.Vector3(),
      localTargetPos: new THREE.Vector3(),
      localTargetQuat: new THREE.Quaternion(),
      relativeTargetPos: new THREE.Vector3(),
      lerpedPos: new THREE.Vector3(),
      lerpedQuat: new THREE.Quaternion(),
      restQuat: new THREE.Quaternion(),
    };
  }

  useFrame((_, delta) => {
    const work = workRef.current;
    if (!work) return;

    elapsedRef.current += delta;
    const t = elapsedRef.current;
    const focusAmount = focusAmountRef.current;

    // 風でゆらゆら揺れるアニメーション(短冊ごとに位相/速度をずらす)。
    // フォーカスに寄っている間は読みやすさのためゆれを止める。
    if (innerRef.current && focusAmount < 0.01) {
      innerRef.current.rotation.z = Math.sin(t * swaySpeed + phase) * 0.12;
      innerRef.current.rotation.x = Math.sin(t * swaySpeed * 0.7 + phase * 1.3) * 0.06;
    }

    // 新規短冊の登場アニメーション: 上からふわっと降りてくる + フェード + スケールイン
    if (groupRef.current && !introDone) {
      const duration = 1.4;
      const progress = Math.min(t / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      groupRef.current.position.y = THREE.MathUtils.lerp(
        introStart,
        position[1],
        eased
      );
      const scale = THREE.MathUtils.lerp(0.2, 1, eased);
      groupRef.current.scale.setScalar(scale);

      groupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material as THREE.Material & { opacity?: number; transparent?: boolean };
          if (mat) {
            mat.transparent = true;
            mat.opacity = eased;
          }
        }
      });

      if (progress >= 1) {
        setIntroDone(true);
      }
    }

    // --- フォーカス(ポップアップ)アニメーション ---
    if (!focusRef.current || !groupRef.current) return;

    const decay = 1 - Math.exp(-FOCUS_LERP_SPEED * delta);
    const targetAmount = isSelected ? 1 : 0;
    let nextAmount = focusAmount + (targetAmount - focusAmount) * decay;
    // 十分収束したら丸めてしまう(わずかな差分が永遠に残るのを防ぐ)
    if (Math.abs(targetAmount - nextAmount) < 0.001) {
      nextAmount = targetAmount;
    }
    focusAmountRef.current = nextAmount;

    if (nextAmount <= 0.001) {
      // 完全に非フォーカス状態: focusGroupを親のローカル原点に一致させ、
      // 通常の吊り下げ表示をそのまま見せる。
      focusRef.current.position.set(0, 0, 0);
      focusRef.current.quaternion.identity();
      focusRef.current.scale.setScalar(1);
      return;
    }

    // カメラの手前・正面の目標ワールド座標/回転を計算
    camera.getWorldDirection(work.camDir);
    work.targetWorldPos
      .copy(camera.position)
      .addScaledVector(work.camDir, FOCUS_DISTANCE);
    work.targetWorldQuat.copy(camera.quaternion);

    // 親(回転するグループ)のワールド変換を取得し、逆変換でローカル座標に落とし込む。
    // これにより、笹グループが回転していても選択中の短冊はワールド座標系で
    // カメラ正面に安定して表示され続ける。
    const parent = groupRef.current.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.matrixWorld.decompose(
        work.parentWorldPos,
        work.parentWorldQuat,
        work.parentWorldScale
      );
      work.parentWorldQuatInverse.copy(work.parentWorldQuat).invert();

      work.localTargetPos
        .copy(work.targetWorldPos)
        .sub(work.parentWorldPos)
        .applyQuaternion(work.parentWorldQuatInverse);
      work.localTargetPos.x /= work.parentWorldScale.x || 1;
      work.localTargetPos.y /= work.parentWorldScale.y || 1;
      work.localTargetPos.z /= work.parentWorldScale.z || 1;

      work.localTargetQuat
        .copy(work.parentWorldQuatInverse)
        .multiply(work.targetWorldQuat);
    } else {
      work.localTargetPos.copy(work.targetWorldPos);
      work.localTargetQuat.copy(work.targetWorldQuat);
    }

    // focusRefはgroupRef(短冊の基準位置、introのオフセット/スケールを持つ)の
    // 子なので、groupRef自身のローカル位置とスケールを差し引いた相対値にする。
    const groupScale = groupRef.current.scale.x || 1;
    work.relativeTargetPos
      .copy(work.localTargetPos)
      .sub(groupRef.current.position)
      .divideScalar(groupScale);

    // 非フォーカス時の基準トランスフォーム(focusRef視点ではidentity/scale1)から
    // フォーカス目標へ focusAmount ぶんだけ補間する。
    work.lerpedPos.set(0, 0, 0).lerp(work.relativeTargetPos, nextAmount);
    work.lerpedQuat.copy(work.restQuat).slerp(work.localTargetQuat, nextAmount);
    const targetScale = 1 + (FOCUS_SCALE_MULTIPLIER - 1) * nextAmount;

    focusRef.current.position.copy(work.lerpedPos);
    focusRef.current.quaternion.copy(work.lerpedQuat);
    focusRef.current.scale.setScalar(targetScale);
  });

  const initialY = isNew ? introStart : position[1];
  const initialScale = isNew ? 0.2 : 1;

  // onClick(react-three-fiberの内部的なinitialHits照合)はOrbitControlsとポインタ
  // イベントを奪い合う場面で信頼できないことがあるため、pointerdown/pointerupの
  // 座標差分が小さい場合のみ「クリック」とみなす自前実装にする。
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const CLICK_MOVE_THRESHOLD = 6;

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    pointerDownPos.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const start = pointerDownPos.current;
    pointerDownPos.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) <= CLICK_MOVE_THRESHOLD) {
      onSelect?.(tanzaku.id);
    }
  };

  return (
    <group
      ref={groupRef}
      position={[position[0], initialY, position[2]]}
      scale={initialScale}
    >
      {/* 紐: 枝から短冊上部まで垂れる細い円柱(フォーカス中も基準位置に残す) */}
      <mesh position={[0, HEIGHT / 2 + STRING_LENGTH / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, STRING_LENGTH, 6]} />
        <meshStandardMaterial color={tanzaku.color} roughness={0.6} />
      </mesh>

      {/* フォーカス時にカメラ手前へポップアップするグループ。
          非選択時はここに何もオフセットが乗らず、通常表示と完全に一致する。 */}
      <group ref={focusRef}>
        {/* 揺れる短冊本体 */}
        <group ref={innerRef} position={[0, HEIGHT / 2, 0]}>
          <group position={[0, -HEIGHT / 2, 0]}>
            {/* 縁取り(色紙の枠)。クリック判定はここに持たせる(常にマウントされているmesh) */}
            <mesh
              position={[0, 0, -0.002]}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            >
              <planeGeometry args={[WIDTH + 0.06, HEIGHT + 0.06]} />
              <meshStandardMaterial color={tanzaku.color} roughness={0.9} />
            </mesh>
            <TanzakuPaper
              imageUrl={tanzaku.imageUrl}
              color={tanzaku.color}
              isSelected={isSelected}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            />
          </group>
        </group>
      </group>
    </group>
  );
}
