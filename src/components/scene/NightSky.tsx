"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { mulberry32 } from "./random";

/**
 * 七夕の夜空。
 * - 深い紺〜藍色のグラデーション背景を大きな球体(内側から見る)で表現
 * - drei の <Stars /> でキラキラした星空
 * - 天の川風の淡い帯(パーティクルの円盤)
 * - 行灯・提灯をイメージした暖色のほのかな光源を点在させる
 */

function SkyDome() {
  // 天頂: 濃紺 / 水平線付近: 少し明るい藍〜紫がかった色 のグラデーションを
  // 頂点カラーで表現した大球体。カメラを内側から包む背景として使う。
  const geometry = useMemo(() => {
    // Stars(radius=70, depth=50)は最大 radius+depth=120 の距離まで配置されるため、
    // ドームはそれより十分外側(半径160)に置いて深度テストで裏に隠れないようにする。
    const domeRadius = 160;
    const geo = new THREE.SphereGeometry(domeRadius, 32, 32);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const zenith = new THREE.Color("#0c1230"); // 天頂: 明るめの紺
    const horizon = new THREE.Color("#3a2a6a"); // 水平線: 明るい藍紫

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / domeRadius; // -1 (下) 〜 1 (上)
      // 水平線(y=0付近)を基準に、上に行くほどzenith、下もzenithに近づける
      const t = THREE.MathUtils.clamp(1 - Math.abs(y), 0, 1);
      const mixed = horizon.clone().lerp(zenith, 1 - t * 0.85);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[0, 0, 0]}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
    </mesh>
  );
}

function MilkyWay() {
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    const count = 3600; // パーティクル数を増やして密度を上げる (変更前: 2400)
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const bandColorA = new THREE.Color("#f0f4ff"); // 白に近い明るい青
    const bandColorB = new THREE.Color("#bfccff"); // 明るいラベンダーブルー

    // 装飾用のパーティクル配置は固定シードの疑似乱数で生成する
    // (Math.random だと再レンダーの度に結果が変わってしまうため)。
    const rand = mulberry32(0x7a17d001);

    // 天の川を、笹を中心とした「傾いた大円」状の帯として全周に配置する。
    // 1) まず水平円(XZ平面, 半径R)上の点を作る
    // 2) それをX軸まわりにtiltAngleだけ回転させ、地平線から地平線へ弧を描く
    //    傾いた大円にする(これによりどの水平方向を向いても帯が視界に入る)
    const R = 55; // Starsの範囲(radius+depth=120)内に収まる半径
    const tiltAngle = THREE.MathUtils.degToRad(35);
    const cosTilt = Math.cos(tiltAngle);
    const sinTilt = Math.sin(tiltAngle);

    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2; // 全周に一様分布
      const radialJitter = (rand() - 0.5) * 18; // 半径方向のばらつき(奥行き/厚み) (変更前: 10)
      const thickness = (rand() - 0.5) * 16; // 帯の厚み方向(傾いた円の法線方向)のふんわりオフセット (変更前: 9)
      const wobble = (rand() - 0.5) * 6; // 帯に沿ったゆらぎ (変更前: 3)

      const r = R + radialJitter;
      // 水平円上の点
      const hx = Math.cos(theta) * r;
      const hz = Math.sin(theta) * r;
      const hy = wobble;

      // X軸まわりにtiltAngleだけ回転(y' = y*cos - z*sin, z' = y*sin + z*cos)
      const rx = hx;
      const ry = hy * cosTilt - hz * sinTilt;
      const rz = hy * sinTilt + hz * cosTilt;

      // 帯の厚み方向(この大円の法線周りのランダムオフセット)を
      // 単純化してワールドYにわずかに加算し、ふんわりした厚みを出す
      const x = rx;
      const y = ry + thickness * cosTilt;
      const z = rz - thickness * sinTilt * 0.3;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = bandColorA.clone().lerp(bandColorB, rand());
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = rand() * 0.6 + 0.15;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.004;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={particles}>
        <pointsMaterial
          size={0.75}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function LanternGlow({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <pointLight color={color} intensity={6} distance={14} decay={2} />
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

export function NightSky() {
  return (
    <>
      <SkyDome />
      <fog attach="fog" args={["#101840", 30, 90]} />
      <Stars
        radius={70}
        depth={50}
        count={6000}
        factor={4}
        saturation={0.2}
        fade
        speed={0.4}
      />
      <MilkyWay />
      {/* 行灯・提灯風のほのかな暖色光 */}
      { /* <LanternGlow position={[6, 2.2, 4]} color="#ffb066" /> 
      <LanternGlow position={[-7, 1.6, -3]} color="#ff8c5a" /> */}
    </>
  );
}
