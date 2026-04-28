import { useEffect, useRef, useState } from "react";

type TileKind = "grass" | "path" | "water" | "tree" | "fence" | "bush" | "stone" | "flower" | "bridge";
type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type Tile = { kind: TileKind };

const TILE = 16;
const SCALE = 3;
const PX = TILE * SCALE;
const VIEW_W = 384;
const VIEW_H = 288;
const COLS = 34;
const ROWS = 26;
const WORLD_W = COLS * PX;
const WORLD_H = ROWS * PX;
const MOVE_MS = 145;
const CAM_LERP = 0.18;
const DEBUG_RATE = 140;
const FOLLOW_LAG = 18;
const FOLLOW_EASE = 0.28;
const FOLLOW_BOB = 0.6;
const START = { x: 16, y: 17 };
const START_CAM = {
  x: Math.max(0, Math.min(START.x * PX + PX / 2 - VIEW_W / 2, WORLD_W - VIEW_W)),
  y: Math.max(0, Math.min(START.y * PX + PX / 2 - VIEW_H / 2, WORLD_H - VIEW_H)),
};

const COLORS: Record<string, string> = {
  grassA: "#77c548", grassB: "#69b53d", grassC: "#8bdc57",
  pathA: "#c59a6b", pathB: "#b98958", pathC: "#dfc09a",
  waterA: "#3f7fd0", waterB: "#2f68bb", waterC: "#5aa2f1", waterD: "#1f4d97",
  treeDark: "#245f13", treeMid: "#34761c", treeLight: "#49a528", trunk: "#7f5430",
  fenceLight: "#f1d6ab", fenceMid: "#debe89", fenceDark: "#b7905c",
  bushA: "#2f7b22", bushB: "#205d15",
  stoneA: "#9ea19a", stoneB: "#7f827d", stoneC: "#d1d2cb",
  flowerA: "#f3a9c8", flowerB: "#ffffff",
  bridgeA: "#a77b4c", bridgeB: "#8e5f35", bridgeC: "#d1b07c",
  hudBg: "rgba(12,12,18,0.72)", hudBorder: "rgba(255,255,255,0.08)",
};

const world: Tile[][] = buildWorld();
const solidKinds = new Set<TileKind>(["water", "tree", "fence", "bush"]);

function buildWorld(): Tile[][] {
  const rows: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: "grass" as TileKind })),
  );
  const set = (x: number, y: number, kind: TileKind) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) rows[y][x] = { kind }; };
  const fill = (x1: number, y1: number, x2: number, y2: number, kind: TileKind) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(x, y, kind); };
  const line = (x1: number, y1: number, x2: number, y2: number, kind: TileKind) => {
    const dx = Math.sign(x2 - x1); const dy = Math.sign(y2 - y1);
    let x = x1, y = y1;
    while (true) { set(x, y, kind); if (x === x2 && y === y2) break; x += dx; y += dy; }
  };

  for (let x = 0; x < COLS; x++) { set(x, 0, "tree"); set(x, ROWS - 1, "tree"); }
  for (let y = 0; y < ROWS; y++) { set(0, y, "tree"); set(COLS - 1, y, "tree"); }
  fill(0, 12, 1, 13, "path"); fill(COLS - 2, 12, COLS - 1, 13, "path");
  fill(16, 24, 17, 25, "path"); fill(16, 0, 17, 1, "path");
  fill(2, 2, 4, 4, "bush"); fill(29, 2, 31, 4, "bush");
  fill(2, 21, 4, 23, "bush"); fill(29, 21, 31, 23, "bush");
  fill(12, 8, 21, 15, "water"); fill(11, 7, 22, 16, "stone"); fill(13, 9, 20, 14, "water");
  fill(16, 16, 17, 16, "bridge"); fill(15, 16, 18, 16, "path"); fill(14, 17, 19, 17, "path");
  fill(16, 18, 17, 24, "path"); fill(14, 16, 19, 17, "path");
  fill(8, 11, 11, 12, "path"); fill(22, 11, 25, 12, "path");
  fill(6, 11, 7, 12, "path"); fill(26, 11, 27, 12, "path");
  fill(11, 5, 22, 6, "path"); fill(13, 6, 20, 7, "path");
  fill(12, 17, 21, 18, "path"); fill(9, 10, 10, 15, "path"); fill(23, 10, 24, 15, "path");
  fill(4, 6, 7, 8, "flower"); fill(26, 6, 29, 8, "flower");
  fill(4, 17, 7, 19, "flower"); fill(26, 17, 29, 19, "flower");
  fill(8, 3, 11, 4, "flower"); fill(22, 3, 25, 4, "flower");
  fill(8, 21, 11, 22, "flower"); fill(22, 21, 25, 22, "flower");
  fill(6, 9, 7, 10, "stone"); fill(26, 9, 27, 10, "stone");
  set(16, 9, "stone"); set(17, 9, "stone"); set(16, 10, "stone"); set(17, 10, "stone");
  for (const x of [2, 3, 5, 28, 30, 31]) { set(x, 1, "tree"); set(x, 24, "tree"); }
  for (const y of [2, 3, 4, 21, 22, 23]) { set(1, y, "tree"); set(COLS - 2, y, "tree"); }
  fill(10, 6, 23, 7, "path"); fill(10, 15, 23, 16, "path");
  fill(10, 7, 11, 15, "path"); fill(22, 7, 23, 15, "path");
  fill(15, 18, 18, 23, "path"); fill(15, 23, 18, 23, "path");
  fill(12, 18, 13, 20, "grass"); fill(20, 18, 21, 20, "grass");
  fill(4, 12, 5, 14, "grass"); fill(28, 12, 29, 14, "grass");
  fill(16, 24, 17, 25, "path"); fill(16, 0, 17, 1, "path");
  fill(0, 12, 1, 13, "path"); fill(COLS - 2, 12, COLS - 1, 13, "path");
  return rows;
}

function isSolid(x: number, y: number) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return solidKinds.has(world[y][x].kind);
}

function drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = COLORS.grassA; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = seed % 2 === 0 ? COLORS.grassB : COLORS.grassC;
  ctx.fillRect(x + 3, y + 8, 2, 2); ctx.fillRect(x + 10, y + 4, 1, 1);
  ctx.fillRect(x + 18, y + 12, 2, 2); ctx.fillRect(x + 28, y + 6, 1, 1); ctx.fillRect(x + 34, y + 22, 2, 2);
}

function drawPath(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = COLORS.pathA; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = COLORS.pathB;
  ctx.fillRect(x + 2, y + 6, 6, 2); ctx.fillRect(x + 19, y + 10, 8, 2); ctx.fillRect(x + 11, y + 24, 10, 2);
  ctx.fillStyle = COLORS.pathC;
  ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + 14, y + 4, 2, 2); ctx.fillRect(x + 23, y + 18, 2, 2);
  if (seed % 2 === 0) { ctx.fillRect(x + 31, y + 8, 2, 2); ctx.fillRect(x + 5, y + 20, 2, 2); }
}

function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  ctx.fillStyle = COLORS.waterA; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = frame % 2 === 0 ? COLORS.waterB : COLORS.waterC;
  const bands = frame % 4 === 0 ? [6, 16, 26] : frame % 4 === 1 ? [4, 14, 24] : frame % 4 === 2 ? [8, 18, 28] : [5, 15, 25];
  for (const band of bands) { ctx.fillRect(x + 3, y + band, 10, 2); ctx.fillRect(x + 18, y + band, 16, 2); }
  ctx.fillStyle = COLORS.waterD;
  ctx.fillRect(x + 5, y + 4, 2, 2); ctx.fillRect(x + 26, y + 9, 2, 2); ctx.fillRect(x + 14, y + 20, 2, 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x + 9, y + 7, 5, 1); ctx.fillRect(x + 23, y + 18, 6, 1);
}

function drawFence(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = COLORS.fenceLight; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = COLORS.fenceMid; ctx.fillRect(x, y + 10, PX, 8);
  ctx.fillStyle = COLORS.fenceDark;
  ctx.fillRect(x + 4, y + 4, 4, 16); ctx.fillRect(x + 16, y + 4, 4, 16); ctx.fillRect(x + 28, y + 4, 4, 16);
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(x + 4, y + 4, 2, 2); ctx.fillRect(x + 16, y + 4, 2, 2);
}

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = COLORS.stoneB; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = COLORS.stoneA; ctx.fillRect(x + 3, y + 4, 12, 8); ctx.fillRect(x + 20, y + 6, 10, 7); ctx.fillRect(x + 9, y + 18, 12, 7);
  ctx.fillStyle = COLORS.stoneC; ctx.fillRect(x + 5, y + 6, 3, 2); ctx.fillRect(x + 23, y + 8, 2, 2);
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = COLORS.grassA; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = COLORS.bushA; ctx.fillRect(x + 4, y + 10, 24, 14); ctx.fillRect(x + 10, y + 5, 8, 8);
  ctx.fillStyle = COLORS.bushB; ctx.fillRect(x + 7, y + 12, 5, 5); ctx.fillRect(x + 20, y + 13, 4, 4);
  ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fillRect(x + 9, y + 8, 3, 2);
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = COLORS.grassB; ctx.fillRect(x, y, PX, PX);
  const offs = [[5, 5], [15, 7], [25, 4], [10, 17], [22, 18], [30, 10], [7, 24], [19, 24]];
  for (let i = 0; i < offs.length; i++) {
    const [ox, oy] = offs[(i + seed) % offs.length];
    ctx.fillStyle = COLORS.flowerA; ctx.fillRect(x + ox - 1, y + oy - 1, 3, 3);
    ctx.fillStyle = COLORS.flowerB; ctx.fillRect(x + ox, y + oy, 1, 1);
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = COLORS.bridgeA; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = COLORS.bridgeB; ctx.fillRect(x, y + 10, PX, 8);
  ctx.fillStyle = COLORS.bridgeC;
  for (let i = 2; i < PX; i += 8) ctx.fillRect(x + i, y + 4, 2, 24);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = COLORS.grassA; ctx.fillRect(x, y, PX, PX);
  ctx.fillStyle = COLORS.treeDark; ctx.fillRect(x + 5, y + 0, 22, 14); ctx.fillRect(x + 2, y + 6, 28, 12);
  ctx.fillStyle = COLORS.treeMid; ctx.fillRect(x + 6, y + 2, 20, 11); ctx.fillRect(x + 4, y + 8, 24, 10);
  ctx.fillStyle = COLORS.treeLight; ctx.fillRect(x + 9, y + 4, 7, 5); ctx.fillRect(x + 20, y + 8, 5, 4);
  ctx.fillStyle = COLORS.trunk; ctx.fillRect(x + 13, y + 15, 8, 13);
  ctx.fillStyle = COLORS.bushB; ctx.fillRect(x + 11, y + 22, 3, 5); ctx.fillRect(x + 19, y + 22, 3, 5);
}

function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, frame: number, seed: number) {
  switch (tile.kind) {
    case "grass": drawGrass(ctx, x, y, seed); break;
    case "path": drawPath(ctx, x, y, seed); break;
    case "water": drawWater(ctx, x, y, frame); break;
    case "tree": drawTree(ctx, x, y); break;
    case "fence": drawFence(ctx, x, y); break;
    case "bush": drawBush(ctx, x, y); break;
    case "stone": drawStone(ctx, x, y); break;
    case "flower": drawFlower(ctx, x, y, seed); break;
    case "bridge": drawBridge(ctx, x, y); break;
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, dir: Dir, frame: number) {
  const scale = SCALE;
  const flip = dir === "left";
  const px = (dx: number, dy: number, color: string) => {
    const fx = flip ? TILE - 1 - dx : dx;
    ctx.fillStyle = color;
    ctx.fillRect(x + fx * scale, y + dy * scale, scale, scale);
  };
  const row = (dy: number, start: number, end: number, color: string) => { for (let dx = start; dx <= end; dx++) px(dx, dy, color); };
  const walk = frame === 0 ? 0 : frame === 1 ? 1 : 2;
  const legLeft = walk === 1 ? [4, 5] : walk === 2 ? [3, 4] : [4, 5];
  const legRight = walk === 1 ? [10, 11] : walk === 2 ? [11, 12] : [10, 11];
  row(0, 6, 9, "#1b1b1b"); row(1, 5, 10, "#1b1b1b");
  row(2, 6, 9, "#c78a4d"); row(3, 6, 9, "#c78a4d");
  row(4, 5, 10, "#1b1b1b"); row(4, 6, 9, "#ef3a3a"); row(5, 5, 10, "#ef3a3a");
  px(7, 6, "#ffffff"); px(8, 6, "#ffffff");
  row(2, 6, 9, "#c78a4d"); row(3, 6, 9, "#c78a4d"); row(4, 6, 9, "#ef3a3a"); row(5, 6, 9, "#ef3a3a"); row(6, 6, 9, "#ef3a3a");
  px(6, 7, "#ffffff"); px(9, 7, "#ffffff");
  row(7, 5, 10, "#1b1b1b"); row(8, 5, 10, "#1b1b1b");
  px(7, 8, "#2b5bf0"); px(8, 8, "#2b5bf0"); px(7, 9, "#2b5bf0"); px(8, 9, "#2b5bf0");
  px(legLeft[0], 10, "#1b1b1b"); px(legLeft[1], 10, "#2b5bf0"); px(legRight[0], 10, "#1b1b1b"); px(legRight[1], 10, "#2b5bf0");
  px(legLeft[0], 11, "#1b1b1b"); px(legLeft[1], 11, "#2b5bf0"); px(legRight[0], 11, "#1b1b1b"); px(legRight[1], 11, "#2b5bf0");
  px(legLeft[1], 12, "#1b1b1b"); px(legRight[1], 12, "#1b1b1b");
}

function drawFollower(ctx: CanvasRenderingContext2D, x: number, y: number, dir: Dir, frame: number) {
  const scale = SCALE;
  const flip = dir === "left";
  const px = (dx: number, dy: number, color: string) => {
    const fx = flip ? TILE - 1 - dx : dx;
    ctx.fillStyle = color;
    ctx.fillRect(x + fx * scale, y + dy * scale, scale, scale);
  };
  const row = (dy: number, start: number, end: number, color: string) => { for (let dx = start; dx <= end; dx++) px(dx, dy, color); };
  const tailWiggle = frame % 2 === 0 ? 0 : 1;
  const yellow = "#f7d63d"; const dark = "#2f2411"; const red = "#f06b6b";
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + 8, y + 40, 24, 6);
  row(2, 6, 9, dark); row(3, 5, 10, dark); row(4, 4, 11, dark); row(5, 4, 11, dark);
  row(6, 4, 11, yellow); row(7, 4, 11, yellow); row(8, 4, 11, yellow); row(9, 4, 11, yellow);
  row(10, 5, 10, yellow); row(11, 5, 10, yellow); row(12, 6, 9, dark); row(13, 7, 8, dark);
  px(6, 0, dark); px(9, 0, dark); row(1, 6, 9, yellow);
  px(5, 1, dark); px(10, 1, dark); px(5, 2, yellow); px(10, 2, yellow);
  px(4, 3, dark); px(11, 3, dark); px(4, 4, yellow); px(11, 4, yellow);
  px(6, 5, dark); px(9, 5, dark); px(7, 6, dark); px(8, 6, dark); px(7, 7, yellow); px(8, 7, yellow);
  px(4, 8, dark); px(11, 8, dark); px(5, 9, yellow); px(10, 9, yellow); px(5, 10, yellow); px(10, 10, yellow);
  px(6, 11, dark); px(9, 11, dark); px(6, 12, dark); px(9, 12, dark);
  px(2, 9, dark); px(1, 10, dark); px(0, 11, dark); px(1, 12, yellow); px(2, 12, dark); px(3, 11, yellow);
  px(4, 10, yellow); px(5, 9, yellow); px(6, 8, yellow);
  if (tailWiggle === 0) { px(12, 7, dark); px(13, 6, dark); px(14, 5, dark); px(13, 4, dark); px(12, 3, yellow); px(13, 2, yellow); px(14, 1, dark); }
  else { px(12, 8, dark); px(13, 7, dark); px(14, 6, dark); px(13, 5, yellow); px(12, 4, yellow); px(13, 3, dark); px(14, 2, dark); }
  px(5, 6, red); px(10, 6, red); px(6, 5, "#ffffff"); px(9, 5, "#ffffff");
}

function keyToDir(key: string): Dir | null {
  switch (key) { case "arrowup": case "w": return "up"; case "arrowdown": case "s": return "down"; case "arrowleft": case "a": return "left"; case "arrowright": case "d": return "right"; default: return null; }
}

function dirVector(dir: Dir) { switch (dir) { case "up": return { dx: 0, dy: -1 }; case "down": return { dx: 0, dy: 1 }; case "left": return { dx: -1, dy: 0 }; case "right": return { dx: 1, dy: 0 }; } }

function behindPoint(point: Point, dir: Dir) { switch (dir) { case "up": return { x: point.x, y: point.y + 1 }; case "down": return { x: point.x, y: point.y - 1 }; case "left": return { x: point.x + 1, y: point.y }; case "right": return { x: point.x - 1, y: point.y }; } }

function chooseDirection(active: Set<string>, lastDir: Dir | null) {
  if (lastDir) {
    const held = (lastDir === "up" && (active.has("arrowup") || active.has("w"))) || (lastDir === "down" && (active.has("arrowdown") || active.has("s"))) || (lastDir === "left" && (active.has("arrowleft") || active.has("a"))) || (lastDir === "right" && (active.has("arrowright") || active.has("d"))));
    if (held) return lastDir;
  }
  if (active.has("arrowup") || active.has("w")) return "up";
  if (active.has("arrowdown") || active.has("s")) return "down";
  if (active.has("arrowleft") || active.has("a")) return "left";
  if (active.has("arrowright") || active.has("d")) return "right";
  return null;
}

export default function AmitySquare() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  const debugRef = useRef(false);
  const lastDirRef = useRef<Dir | null>("down");
  const movingRef = useRef(false);
  const moveFromRef = useRef(START);
  const moveToRef = useRef(START);
  const moveProgressRef = useRef(1);
  const facingRef = useRef<Dir>("down");
  const walkFrameRef = useRef(0);
  const camRef = useRef(START_CAM);
  const trailRef = useRef<Point[]>(Array.from({ length: FOLLOW_LAG + 1 }, () => ({ x: START.x, y: START.y })));
  const followerRef = useRef<Point>({ x: START.x - 1.2, y: START.y + 0.2 });
  const followerFacingRef = useRef<Dir>("right");
  const [debug, setDebug] = useState(false);
  const [hud, setHud] = useState({ x: START.x, y: START.y, dir: "down" as Dir, moving: false, followerX: START.x - 1.2, followerY: START.y + 0.2 });

  useEffect(() => { debugRef.current = debug; }, [debug]);
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); const dir = keyToDir(key); if (dir) { event.preventDefault(); keysRef.current.add(key); lastDirRef.current = dir; facingRef.current = dir; } };
    const onUp = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); const dir = keyToDir(key); if (dir) { event.preventDefault(); keysRef.current.delete(key); } };
    window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0; let prev = 0; let hudClock = 0;

    const drawWorld = (frame: number, camX: number, camY: number) => {
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      const startCol = Math.max(0, Math.floor(camX / PX)); const startRow = Math.max(0, Math.floor(camY / PX));
      const endCol = Math.min(COLS - 1, Math.ceil((camX + VIEW_W) / PX)); const endRow = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H) / PX));
      for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
        const tile = world[row][col]; const sx = col * PX - camX; const sy = row * PX - camY;
        drawTile(ctx, sx, sy, tile, frame, row * 37 + col * 17);
      }
    };

    const step = (time: number) => {
      const dt = Math.min(40, time - prev || 16); prev = time;
      const playerTileX = movingRef.current ? moveFromRef.current.x + (moveToRef.current.x - moveFromRef.current.x) * moveProgressRef.current : moveToRef.current.x;
      const playerTileY = movingRef.current ? moveFromRef.current.y + (moveToRef.current.y - moveFromRef.current.y) * moveProgressRef.current : moveToRef.current.y;
      trailRef.current.push({ x: playerTileX, y: playerTileY });
      if (trailRef.current.length > 96) trailRef.current.shift();
      const followIndex = Math.max(0, trailRef.current.length - FOLLOW_LAG);
      const followPoint = trailRef.current[followIndex] ?? { x: playerTileX, y: playerTileY };
      const prevFollowPoint = trailRef.current[Math.max(0, followIndex - 1)] ?? followPoint;
      const anchorPoint = movingRef.current ? followPoint : behindPoint({ x: playerTileX, y: playerTileY }, facingRef.current);
      const prevAnchorPoint = movingRef.current ? prevFollowPoint : behindPoint({ x: playerTileX, y: playerTileY }, facingRef.current);
      followerRef.current = { x: followerRef.current.x + (anchorPoint.x - followerRef.current.x) * FOLLOW_EASE, y: followerRef.current.y + (anchorPoint.y - followerRef.current.y) * FOLLOW_EASE };
      const fx = anchorPoint.x - prevAnchorPoint.x; const fy = anchorPoint.y - prevAnchorPoint.y;
      if (Math.abs(fx) > Math.abs(fy) && Math.abs(fx) > 0.01) followerFacingRef.current = fx > 0 ? "right" : "left";
      else if (Math.abs(fy) > 0.01) followerFacingRef.current = fy > 0 ? "down" : "up";

      if (!movingRef.current) {
        const intent = chooseDirection(keysRef.current, lastDirRef.current);
        if (intent) {
          const { dx, dy } = dirVector(intent);
          const nextX = moveToRef.current.x + dx; const nextY = moveToRef.current.y + dy;
          facingRef.current = intent;
          if (!isSolid(nextX, nextY)) { movingRef.current = true; moveFromRef.current = { ...moveToRef.current }; moveToRef.current = { x: nextX, y: nextY }; moveProgressRef.current = 0; walkFrameRef.current = (walkFrameRef.current + 1) % 3; }
        }
      } else {
        moveProgressRef.current += dt / MOVE_MS;
        if (moveProgressRef.current >= 1) { moveProgressRef.current = 1; movingRef.current = false; moveFromRef.current = { ...moveToRef.current }; walkFrameRef.current = (walkFrameRef.current + 1) % 3; }
      }

      const targetCamX = Math.max(0, Math.min(playerTileX * PX + PX / 2 - VIEW_W / 2, WORLD_W - VIEW_W));
      const targetCamY = Math.max(0, Math.min(playerTileY * PX + PX / 2 - VIEW_H / 2, WORLD_H - VIEW_H));
      camRef.current = { x: camRef.current.x + (targetCamX - camRef.current.x) * CAM_LERP, y: camRef.current.y + (targetCamY - camRef.current.y) * CAM_LERP };
      camRef.current.x = Math.max(0, Math.min(camRef.current.x, WORLD_W - VIEW_W)); camRef.current.y = Math.max(0, Math.min(camRef.current.y, WORLD_H - VIEW_H));
      const camX = camRef.current.x; const camY = camRef.current.y;
      const walkFrame = movingRef.current ? walkFrameRef.current : 0;
      const playerX = playerTileX * PX - camX; const playerY = playerTileY * PX - camY;
      const followerBob = Math.sin(time / 180) * FOLLOW_BOB;
      const followerX = followerRef.current.x * PX - camX; const followerY = followerRef.current.y * PX - camY + followerBob;
      drawWorld(Math.floor(time / 180) % 4, camX, camY);
      drawFollower(ctx, Math.round(followerX), Math.round(followerY), followerFacingRef.current, Math.floor(time / 160) % 2);
      drawPlayer(ctx, Math.round(playerX), Math.round(playerY), facingRef.current, walkFrame);
      ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, VIEW_H - 14, VIEW_W, 14);
      hudClock += dt;
      if (hudClock >= DEBUG_RATE) { hudClock = 0; setHud({ x: Math.round(playerTileX * 10) / 10, y: Math.round(playerTileY * 10) / 10, dir: facingRef.current, moving: movingRef.current, followerX: Math.round(followerRef.current.x * 10) / 10, followerY: Math.round(followerRef.current.y * 10) / 10 }); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden text-white" style={{ background: "radial-gradient(circle at top, #1f4b28 0%, #132016 36%, #090b0d 100%)" }}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-4 p-4">
        <div className="flex w-full max-w-[900px] items-end justify-between gap-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.34em] text-emerald-200/70">Zo Space Recreation</div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Amity Square</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-100/70">A playable, self-contained MVP focused on recognizable layout, clean collision, and stable browser behavior.</p>
          </div>
          <button type="button" onClick={() => setDebug((value) => !value)} className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-medium tracking-wide text-white/85 backdrop-blur transition hover:bg-black/45">{debug ? "Hide debug" : "Show debug"}</button>
        </div>
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.55)]" style={{ width: VIEW_W, height: VIEW_H }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07),transparent_58%)]" />
          <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="block" style={{ width: VIEW_W, height: VIEW_H, imageRendering: "pixelated" }} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-emerald-100/85">
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2">Move: WASD or arrows</div>
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2">Collision: water, trees, fences, bushes</div>
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2">Camera follows and clamps to the park</div>
        </div>
        {debug ? (
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs text-emerald-100/80 shadow-lg backdrop-blur sm:grid-cols-2">
            <div>player tile: {hud.x.toFixed(1)}, {hud.y.toFixed(1)}</div><div>facing: {hud.dir}</div>
            <div>moving: {hud.moving ? "yes" : "no"}</div><div>route: /amity-square</div>
            <div>follower tile: {hud.followerX.toFixed(1)}, {hud.followerY.toFixed(1)}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}