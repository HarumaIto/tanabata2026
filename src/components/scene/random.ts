/**
 * シーン全体で使う決定論的疑似乱数まわりの小さなユーティリティ。
 * Math.random() はレンダー中に呼ぶとReactの purity ルールに違反する
 * (再レンダーの度に結果が変わり不安定になる)ため、装飾的なパーティクル
 * 生成であっても、固定シードから作る seeded random を使う。
 */

/** id文字列を32bit整数にハッシュする(FNV-1aベース)。 */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * mulberry32: 軽量な決定論的疑似乱数生成器。
 * 同じseedからは常に同じ数列を返す。
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
