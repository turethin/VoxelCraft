type PRNG = () => number;

export default function alea(seed: number | string): PRNG {
  let s: number;
  if (typeof seed === "number") {
    s = seed >>> 0;
  } else {
    s = 2166136261;
    for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i);
      s = Math.imul(s, 16777619);
    }
    s >>>= 0;
  }
  return function (): number {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
