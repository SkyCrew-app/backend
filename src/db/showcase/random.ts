// A small seeded generator (mulberry32): the same seed and the same "now"
// give the same club.
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  // A number in [0, 1).
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // An integer in [min, max], both included.
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Random.pick: empty list');
    }
    return items[Math.floor(this.next() * items.length)];
  }

  // One item, each with its weight.
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((sum, [, weight]) => sum + weight, 0);
    let draw = this.next() * total;
    for (const [item, weight] of items) {
      draw -= weight;
      if (draw < 0) return item;
    }
    return items[items.length - 1][0];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // A string of hexadecimal digits.
  hex(length: number): string {
    let out = '';
    while (out.length < length) {
      out += Math.floor(this.next() * 16).toString(16);
    }
    return out;
  }
}

// A generator of its own for one decision of the showcase: the seed of the
// showcase and what the decision is about (a day, a member, a booking...).
// The same parts give the same draws, whatever was drawn before, so that a
// refresh run twice takes the same decisions.
export const randomFor = (
  seed: number,
  ...parts: (string | number)[]
): Random => {
  // FNV-1a over the parts, mixed with the seed.
  let hash = 0x811c9dc5 ^ (seed >>> 0);
  for (const char of parts.join('|')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return new Random(hash >>> 0);
};
