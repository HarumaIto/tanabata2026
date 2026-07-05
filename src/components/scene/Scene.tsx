"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { NightSky } from "./NightSky";
import { Bamboo } from "./Bamboo";
import { TanzakuField } from "./TanzakuField";
import type { Tanzaku } from "@/lib/types";

/**
 * 笹 + 短冊のグループ。常にゆっくり自動回転する
 * (OrbitControlsのautoRotateではなく、group自体のrotation.yを進める方式)。
 * ただし、短冊が選択されている間は読みやすさのため回転を止める。
 */
function RotatingBambooGroup({
  tanzaku,
  selectedId,
  onSelect,
}: {
  tanzaku: Tanzaku[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current && !selectedId) {
      groupRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <Bamboo />
      <TanzakuField tanzaku={tanzaku} selectedId={selectedId} onSelect={onSelect} />
    </group>
  );
}

/**
 * 短冊選択中に背景を少し暗くする、カメラに追従する半透明の黒い平面。
 * ポップアップした短冊(カメラから FOCUS_DISTANCE=3.2 の位置)より
 * 手前ではなく奥(カメラから OVERLAY_DISTANCE)に置くことで、
 * 通常の深度テストにより「短冊は暗くならず、背景だけが暗くなる」ようにする。
 * クリックで選択解除(backdropクリック)できるようにする。
 *
 * クリック判定は react-three-fiber の onClick(pointerdown/pointerup 間の
 * internal.initialHits 照合)に頼らず、pointerdown/pointerup の座標差分が
 * 小さい場合のみ「クリック」とみなす自前実装にする
 * (OrbitControlsとポインタイベントを奪い合う場面でonClickが発火しないことがあるため)。
 */
function DimOverlay({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const CLICK_MOVE_THRESHOLD = 6;

  // ポップアップした短冊(距離3.2)より奥に置く。深度テストは有効のままにして、
  // 手前にある短冊がこの黒い板の前に自然に描画されるようにする。
  const OVERLAY_DISTANCE = 6;

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const decay = 1 - Math.exp(-6 * delta);
    const target = visible ? 0.65 : 0;
    let next = opacityRef.current + (target - opacityRef.current) * decay;
    if (Math.abs(target - next) < 0.002) {
      next = target;
    }
    opacityRef.current = next;

    const material = meshRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = next;
    meshRef.current.visible = next > 0.002;

    const camera = state.camera;
    camera.getWorldDirection(camDir);
    meshRef.current.position.copy(camera.position).addScaledVector(camDir, OVERLAY_DISTANCE);
    meshRef.current.quaternion.copy(camera.quaternion);
  });

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
      onDismiss();
    }
  };

  // react-three-fiberはこのメッシュの visible(three.jsの見た目)を見ずに、
  // 「onPointerDown/onPointerUpハンドラが登録されているかどうか」だけでraycast対象に
  // 含めるかどうかを決める。非選択時もハンドラを常時つけたままにすると、カメラの
  // すぐ手前(距離6)にあるこの巨大な板が、奥にある短冊(距離15前後)より先に
  // ヒットしてクリックを飲み込んでしまう(stopPropagationで短冊まで届かなくなる)。
  // そのため、実際に暗転している(=選択中の短冊がある)時だけハンドラを付与する。
  return (
    <mesh
      ref={meshRef}
      onPointerDown={visible ? handlePointerDown : undefined}
      onPointerUp={visible ? handlePointerUp : undefined}
      renderOrder={5}
    >
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial color="#000000" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// TEMP TEST HOOK: verification only, removed before finishing this change.
function DebugProbe({ selectedId }: { selectedId: string | null }) {
  useFrame((state) => {
    (window as unknown as Record<string, unknown>).__debug = {
      camera: state.camera,
      scene: state.scene,
      size: state.size,
      selectedId,
      THREE,
      raycaster: state.raycaster,
      pointer: state.pointer,
      internal: state.internal,
      gl: state.gl,
    };
  });
  return null;
}

function SceneLighting() {
  return (
    <>
      {/* やや暗め・青みがかった夜の環境光 */}
      <ambientLight color="#3a4a7a" intensity={0.45} />
      <hemisphereLight color="#3d5a99" groundColor="#0a0e1f" intensity={0.35} />
      {/* 行灯のような温かみのあるポイントライト */}
      <pointLight position={[3, 5, 4]} color="#ffcf9e" intensity={12} distance={20} decay={2} />
      <pointLight position={[-4, 3, -3]} color="#ff9d6c" intensity={8} distance={18} decay={2} />
    </>
  );
}

export function TanabataScene({ tanzaku }: { tanzaku: Tanzaku[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const handleDismiss = useCallback(() => {
    setSelectedId(null);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 9, 18], fov: 42, near: 0.1, far: 250 }}
        onPointerMissed={handleDismiss}
      >
        <SceneLighting />
        <NightSky />
        <RotatingBambooGroup
          tanzaku={tanzaku}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <DimOverlay visible={selectedId !== null} onDismiss={handleDismiss} />
        <DebugProbe selectedId={selectedId} />
        <OrbitControls
          enabled={selectedId === null}
          enableDamping
          dampingFactor={0.08}
          minDistance={9}
          maxDistance={26}
          maxPolarAngle={Math.PI * 0.52}
          minPolarAngle={Math.PI * 0.12}
          target={[0, 4.0, 0]}
        />
      </Canvas>
    </div>
  );
}
