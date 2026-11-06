import type { Point } from "./types";
import type { HandFrame } from "./landmarkSigns";

/** Kinematic hand used by tests and the synthetic fixture set. Not a webcam recording. */

export function P(x: number, y: number, z = 0): Point {
  return { x, y, z, visibility: 1 };
}

export function add(a: Point, b: Point): Point {
  return P(a.x + b.x, a.y + b.y, a.z + b.z);
}

function mul(a: Point, k: number): Point {
  return P(a.x * k, a.y * k, a.z * k);
}

function rotX(p: Point, rad: number): Point {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return P(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

function rotZ(p: Point, rad: number): Point {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return P(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}

export type Thumb = "out" | "across" | "pinch" | "side" | "crease" | "v" | "along" | "bundle" | "over3" | "over2";
export type Facing = "camera" | "up" | "down";
export type Pointing = "up" | "side" | "down";

export function buildLocal(
  curls: [number, number, number, number],
  thumb: Thumb,
  spread = 0,
  cross = false,
): Point[] {
  const pts = Array.from({ length: 21 }, () => P(0, 0, 0));
  const mcps = [
    P(-0.022 - spread * 0.01, -0.055, 0),
    P(-0.004, -0.062, 0),
    P(0.014, -0.056, 0),
    P(0.03 + spread * 0.01, -0.046, 0),
  ];
  const bases = [5, 9, 13, 17];
  const fan = [-spread, -spread * 0.2, spread * 0.2, spread];
  for (let f = 0; f < 4; f++) {
    pts[bases[f]] = mcps[f];
    const segs = [0.026, 0.018, 0.015];
    let pos = mcps[f];
    let angle = 0;
    for (let s = 0; s < 3; s++) {
      angle += curls[f] * Math.PI * 0.55;
      const dir = normalize(P(fan[f] * (1 - curls[f] * 0.5), -Math.cos(angle), -Math.sin(angle)));
      pos = add(pos, mul(dir, segs[s]));
      pts[bases[f] + 1 + s] = pos;
    }
  }
  pts[1] = P(-0.012, -0.012, 0);
  pts[2] = P(-0.028, -0.02, 0);
  if (thumb === "out") {
    pts[3] = P(-0.048, -0.012, 0);
    pts[4] = P(-0.066, 0.004, 0);
  } else if (thumb === "across") {
    pts[3] = P(-0.01, -0.03, -0.005);
    pts[4] = P(0.008, -0.04, -0.008);
  } else if (thumb === "side") {
    pts[3] = P(-0.026, -0.03, 0);
    pts[4] = P(-0.03, -0.05, 0.008);
  } else if (thumb === "crease") {
    pts[4] = centroid([pts[5], pts[9]]);
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "v") {
    pts[4] = add(centroid([pts[6], pts[10]]), P(0, 0.008, -0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "along") {
    pts[4] = add(pts[6], P(-0.01, 0.002, -0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "over3") {
    pts[4] = add(centroid([pts[6], pts[10], pts[14]]), P(0, 0.003, 0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "over2") {
    pts[4] = add(centroid([pts[6], pts[10]]), P(-0.004, 0.003, 0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "bundle") {
    pts[4] = add(centroid([pts[8], pts[12], pts[16], pts[20]]), P(0.002, 0.002, 0));
    pts[3] = centroid([pts[2], pts[4]]);
  } else {
    const tip = centroid([pts[8], pts[12], pts[16]]);
    pts[4] = add(tip, P(0.003, 0.004, 0.002));
    pts[3] = centroid([pts[2], pts[4]]);
  }
  if (cross) {
    const indexX = pts[8].x;
    pts[8] = P(pts[12].x, pts[8].y, pts[8].z);
    pts[12] = P(indexX, pts[12].y, pts[12].z);
  }
  return pts;
}

function normalize(p: Point): Point {
  const m = Math.hypot(p.x, p.y, p.z) || 1;
  return mul(p, 1 / m);
}

export function centroid(points: Point[]): Point {
  const n = points.length || 1;
  return mul(
    points.reduce((sum, p) => add(sum, p), P(0, 0, 0)),
    1 / n,
  );
}

function place(
  local: Point[],
  opts: { facing?: Facing; side?: "Left" | "Right"; at?: Point; scale?: number; point?: Pointing },
): Point[] {
  const facing = opts.facing ?? "camera";
  const angle = facing === "up" ? -Math.PI / 2 : facing === "down" ? Math.PI / 2 : 0;
  const spin = opts.point === "down" ? Math.PI : opts.point === "side" ? Math.PI / 2 : 0;
  const k = opts.scale ?? 1;
  const at = opts.at ?? P(0.5, 0.55, 0);
  return local.map((p) => {
    let q = mul(rotX(rotZ(p, spin), angle), k);
    if (opts.side === "Left") q = P(-q.x, q.y, q.z);
    return add(q, at);
  });
}

export function hand(opts: {
  curls: [number, number, number, number];
  thumb?: Thumb;
  facing?: Facing;
  side?: "Left" | "Right";
  at?: Point;
  scale?: number;
  spread?: number;
  point?: Pointing;
  cross?: boolean;
  /** Place the thumb tip on this landmark after the fingers are posed. */
  thumbOn?: number;
  /** Pull the fingertips together, as in E. */
  gather?: boolean;
}): HandFrame {
  const local = buildLocal(opts.curls, opts.thumb ?? "out", opts.spread ?? 0, opts.cross ?? false);
  if (opts.gather) {
    const center = centroid([local[8], local[12], local[16], local[20]]);
    for (const tip of [8, 12, 16, 20]) {
      local[tip] = add(center, mul(P(local[tip].x - center.x, local[tip].y - center.y, local[tip].z - center.z), 0.2));
    }
    local[4] = add(center, P(0.001, 0.001, 0));
    local[3] = centroid([local[2], local[4]]);
  }
  if (opts.thumbOn !== undefined) {
    local[4] = add(local[opts.thumbOn], P(0.002, 0.002, 0.001));
    local[3] = centroid([local[2], local[4]]);
  }
  const side = opts.side ?? "Right";
  return {
    landmarks: place(local, opts),
    worldLandmarks: local,
    handedness: side,
  };
}

export type HandOptions = Parameters<typeof hand>[0];

