"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * プロシージャルな笹。
 * 幹 = 節ごとに少し太さが変わる円柱の積み重ね。
 * 枝 = 節から斜めに伸びる細い円柱。
 * 葉 = 枝の先にクラスタ状に配置した細長い平面(両面表示)。
 */

const TRUNK_GREEN_DARK = new THREE.Color("#1f5b3a");
const TRUNK_GREEN_LIGHT = new THREE.Color("#4f9a5a");
const LEAF_GREEN_DARK = new THREE.Color("#2f7a45");
const LEAF_GREEN_LIGHT = new THREE.Color("#9fd66a");

type Segment = {
  y: number;
  height: number;
  radiusBottom: number;
  radiusTop: number;
};

function buildTrunkSegments(totalHeight: number, segmentCount: number, baseRadius: number): Segment[] {
  const segments: Segment[] = [];
  let y = 0;
  for (let i = 0; i < segmentCount; i++) {
    const tSeg = i / segmentCount;
    const height = totalHeight / segmentCount;
    // 上に行くほど少し細くなる、節ごとにわずかに太さが変動
    const taper = 1 - tSeg * 0.55;
    const wobble = 1 + Math.sin(i * 1.7) * 0.06;
    const radiusBottom = baseRadius * taper * wobble;
    const radiusTop = baseRadius * (1 - (tSeg + 1 / segmentCount) * 0.55) * wobble;
    segments.push({ y, height, radiusBottom, radiusTop });
    y += height;
  }
  return segments;
}

function LeafBlade({
  length,
  width,
  color,
}: {
  length: number;
  width: number;
  color: THREE.Color;
}) {
  // 笹の葉らしい、根本が広く先が尖る形状を独自ジオメトリで作る
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(width * 0.5, length * 0.15, width * 0.35, length * 0.55);
    shape.quadraticCurveTo(width * 0.15, length * 0.9, 0, length);
    shape.quadraticCurveTo(-width * 0.15, length * 0.9, -width * 0.35, length * 0.55);
    shape.quadraticCurveTo(-width * 0.5, length * 0.15, 0, 0);
    return new THREE.ShapeGeometry(shape);
  }, [length, width]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        roughness={0.6}
        metalness={0.05}
      />
    </mesh>
  );
}

function LeafCluster({
  position,
  rotationY,
  tiltX,
  scale,
  colorMix,
}: {
  position: [number, number, number];
  rotationY: number;
  tiltX: number;
  scale: number;
  colorMix: number;
}) {
  const leafColor = useMemo(
    () => LEAF_GREEN_DARK.clone().lerp(LEAF_GREEN_LIGHT, colorMix),
    [colorMix]
  );

  const leaves = 3;
  return (
    <group position={position} rotation={[tiltX, rotationY, 0]} scale={scale}>
      {/* 小枝 */}
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.6, 5]} />
        <meshStandardMaterial color={TRUNK_GREEN_LIGHT} roughness={0.7} />
      </mesh>
      {Array.from({ length: leaves }).map((_, i) => {
        const spread = (i - (leaves - 1) / 2) * 0.35;
        return (
          <group
            key={i}
            position={[0, 0.55 + i * 0.12, 0]}
            rotation={[0.15, spread, spread * 0.4]}
          >
            <LeafBlade length={1.1 - i * 0.12} width={0.16} color={leafColor} />
          </group>
        );
      })}
    </group>
  );
}

function Branch({
  origin,
  angle,
  length,
  colorMix,
}: {
  origin: [number, number, number];
  angle: number;
  length: number;
  colorMix: number;
}) {
  const branchColor = useMemo(
    () => TRUNK_GREEN_DARK.clone().lerp(TRUNK_GREEN_LIGHT, colorMix),
    [colorMix]
  );

  return (
    <group position={origin} rotation={[0, angle, Math.PI / 3.2]}>
      <mesh position={[0, length / 2, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.045, length, 6]} />
        <meshStandardMaterial color={branchColor} roughness={0.75} />
      </mesh>
      <LeafCluster
        position={[0, length, 0]}
        rotationY={angle * 1.3}
        tiltX={0.3}
        scale={1}
        colorMix={colorMix}
      />
      <LeafCluster
        position={[0, length * 0.7, 0]}
        rotationY={angle * 1.3 + Math.PI * 0.5}
        tiltX={0.5}
        scale={0.8}
        colorMix={colorMix * 0.7}
      />
    </group>
  );
}

function Culm({
  offset,
  height,
  baseRadius,
  leanAngle,
}: {
  offset: [number, number];
  height: number;
  baseRadius: number;
  leanAngle: number;
}) {
  const segmentCount = 9;
  const segments = useMemo(
    () => buildTrunkSegments(height, segmentCount, baseRadius),
    [height, baseRadius]
  );

  // 節から生える枝の位置(上のほうの節に集中させる)
  const branchNodes = useMemo(() => {
    const nodes: { segIndex: number; angle: number; length: number }[] = [];
    for (let i = Math.floor(segmentCount * 0.35); i < segmentCount; i++) {
      const branchesHere = i % 2 === 0 ? 2 : 1;
      for (let b = 0; b < branchesHere; b++) {
        nodes.push({
          segIndex: i,
          angle: (i * 2.4 + b * Math.PI) % (Math.PI * 2),
          length: 0.9 + Math.sin(i * 3.1 + b) * 0.3,
        });
      }
    }
    return nodes;
  }, []);

  return (
    <group position={[offset[0], 0, offset[1]]} rotation={[0, 0, leanAngle]}>
      {segments.map((seg, i) => {
        const colorMix = i / segmentCount;
        const color = TRUNK_GREEN_DARK.clone().lerp(TRUNK_GREEN_LIGHT, colorMix);
        return (
          <group key={i}>
            <mesh position={[0, seg.y + seg.height / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry
                args={[seg.radiusTop, seg.radiusBottom, seg.height, 8]}
              />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
            </mesh>
            {/* 節のリング */}
            <mesh position={[0, seg.y + seg.height, 0]}>
              <torusGeometry args={[seg.radiusTop * 1.05, 0.01, 6, 12]} />
              <meshStandardMaterial color={TRUNK_GREEN_DARK} roughness={0.6} />
            </mesh>
          </group>
        );
      })}
      {branchNodes.map((node, i) => {
        const seg = segments[node.segIndex];
        return (
          <Branch
            key={i}
            origin={[0, seg.y + seg.height, 0]}
            angle={node.angle}
            length={node.length}
            colorMix={node.segIndex / segmentCount}
          />
        );
      })}
      {/* 頂点の葉クラスタ */}
      <LeafCluster
        position={[0, height, 0]}
        rotationY={leanAngle}
        tiltX={0.6}
        scale={1.2}
        colorMix={0.9}
      />
    </group>
  );
}

export function Bamboo() {
  return (
    <group>
      <Culm offset={[0, 0]} height={7.2} baseRadius={0.14} leanAngle={0.03} />
      <Culm offset={[0.55, -0.3]} height={6.4} baseRadius={0.11} leanAngle={-0.05} />
      <Culm offset={[-0.5, 0.35]} height={6.8} baseRadius={0.12} leanAngle={0.06} />
    </group>
  );
}
