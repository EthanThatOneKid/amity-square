import { useEffect, useRef, useState, useCallback } from "react";

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type InteractObj = { id: string; x: number; y: number; label: string; dialog: string[] };

const VIEW_W = 384;
const VIEW_H = 288;
const SPRITE = 32;
const PLAYER_DRAW = 32;
const FOLLOWER_DRAW = 32;
const MOVE_SPEED = 84;
const FOLLOW_EASE = 0.16;
const FOLLOW_LAG = 26;
const CAM_LERP = 0.14;
const MASK_THRESHOLD = 180;
const INTERACT_RADIUS = 28;
const TILE = 16; // Must match editor TILE
const GRID_W = Math.ceil(1006 / TILE); // 63
const GRID_H = Math.ceil(774 / TILE); // 49

const PLAYER_SPRITE = "/images/amity-square/lucas-overworld.png";
const FOLLOWER_SPRITE = "/images/amity-square/pikachu-overworld.png";
const MAP_IMAGE = "/images/amity-square/amity-square-map.png";
const WALK_MASK = "/images/amity-square/amity-square-walk-mask.png";
const PUBLISHED_MASK_KEY = "amity-square-mask-v1";
const PUBLISHED_OBJS_KEY = "amity-square-objs-v1";

// Gameplay start — on the main path near the pond
const START = { x: 505, y: 387 };

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function keyToDir(key: string): Dir | null {
  switch (key) {
    case "arrowup": case "w": return "up";
    case "arrowdown": case "s": return "down";
    case "arrowleft": case "a": return "left";
    case "arrowright": case "d": return "right";
    default: return null;
  }
}
function dirVector(dir: Dir) {
  switch (dir) {
    case "up": return { dx: 0, dy: -1 };
    case "down": return { dx: 0, dy: 1 };
    case "left": return { dx: -1, dy: 0 };
    case "right": return { dx: 1, dy: 0 };
  }
}
function chooseDir(active: Set<string>, last: Dir | null): Dir | null {
  if (last && ((last === "up" && active.has("arrowup")) || (last === "up" && active.has("w")) ||
    (last === "down" && active.has("arrowdown")) || (last === "down" && active.has("s")) ||
    (last === "left" && active.has("arrowleft")) || (last === "left" && active.has("a")) ||
    (last === "right" && active.has("arrowright")) || (last === "right" && active.has("d")))) return last;
  if (active.has("arrowup") || active.has("w")) return "up";
  if (active.has("arrowdown") || active.has("s")) return "down";
  if (active.has("arrowleft") || active.has("a")) return "left";
  if (active.has("arrowright") || active.has("d")) return "right";
  return null;
}

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(Math.round(cx), Math.round(cy), 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  sx: number, sy: number,
  dx: number, dy: number,
  dw: number, dh: number,
  row: number, col: number,
) {
  ctx.drawImage(sprite, col * SPRITE, row * SPRITE, SPRITE, SPRITE, dx, dy, dw, dh);
}

// Load a workspace JSON file (published by the editor) — returns null if absent
async function loadPublishedFile(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// Load a workspace PNG as ImageData — returns null if absent
async function loadPublishedMask(path: string, mapW: number, mapH: number): Promise<Uint8ClampedArray | null> {
  try {
    const img = new Image();
    const loaded = new Promise<boolean>((res, rej) => { img.onload = () => res(true); img.onerror = () => rej(); });
    img.crossOrigin = "anonymous";
    img.src = path;
    await loaded;
    const offscreen = document.createElement("canvas");
    offscreen.width = mapW;
    offscreen.height = mapH;
    offscreen.getContext("2d")!.drawImage(img, 0, 0);
    return new Uint8ClampedArray(offscreen.getContext("2d")!.getImageData(0, 0, mapW, mapH).data);
  } catch { return null; }
}

// Default objects (used when no published objects exist)
const DEFAULT_OBJS: InteractObj[] = [
  { id: "nurse", x: 580, y: 385, label: "Nurse Joy", dialog: ["Welcome to Amity Square!", "Your Pikachu looks so happy out here.", "Take care of each other! ♥"] },
  { id: "sign", x: 490, y: 420, label: "Info Sign", dialog: ["Amity Square", "A relaxing park in Hearthome City.", "Only specially-bonded Pokémon can visit."] },
];

// Tile-based collision — fast lookup from mask data
// tileX, tileY are in TILE-pixel grid coords
function tileWalkableFromMask(maskData: Uint8ClampedArray, maskW: number, tileTX: number, tileTY: number): boolean {
  const px = tileTX * TILE;
  const py = tileTY * TILE;
  for (let dy = 0; dy < TILE; dy++) {
    for (let dx = 0; dx < TILE; dx++) {
      const mx = px + dx;
      const my = py + dy;
      if (mx < 0 || my < 0 || mx >= maskW || my >= 774) return false;
      if (maskData[my * maskW + mx] > MASK_THRESHOLD) return true;
    }
  }
  return false;
}

export default function AmitySquare() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  const lastDirRef = useRef<Dir | null>("down");
  const facingRef = useRef<Dir>("down");
  const followerFacingRef = useRef<Dir>("down");
  const playerRef = useRef<Point>({ ...START });
  const followerRef = useRef<Point>({ x: START.x - 28, y: START.y + 10 });
  const trailRef = useRef<Point[]>(Array.from({ length: 160 }, () => ({ ...START })));
  const camRef = useRef<Point>({ x: 0, y: 0 });
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);
  const followerSpriteRef = useRef<HTMLImageElement | null>(null);
  const mapRef = useRef<HTMLImageElement | null>(null);
  const maskDataRef = useRef<Uint8ClampedArray | null>(null);
  const interactObjsRef = useRef<InteractObj[]>(DEFAULT_OBJS);
  const worldSizeRef = useRef({ w: 1006, h: 774 });
  const publishedTileDataRef = useRef<boolean[][] | null>(null);

  const [debug, setDebug] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const showMaskRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState({ x: START.x, y: START.y, dir: "down" as Dir, tileTX: -1, tileTY: -1, walkable: false });
  const [dialog, setDialog] = useState<string[] | null>(null);
  const [dialogIdx, setDialogIdx] = useState(0);
  const dialogRef = useRef<string[] | null>(null);
  useEffect(() => { dialogRef.current = dialog; }, [dialog]);

  const buildTileGrid = (maskData: Uint8ClampedArray, maskW: number, maskH: number): boolean[][] => {
    const grid: boolean[][] = [];
    for (let ty = 0; ty < GRID_H; ty++) {
      grid[ty] = [];
      for (let tx = 0; tx < GRID_W; tx++) {
        grid[ty][tx] = tileWalkableFromMask(maskData, maskW, tx, ty);
      }
    }
    return grid;
  };

  useEffect(() => {
    let live = true;
    const playerSprite = new Image();
    const followerSprite = new Image();
    const mapImage = new Image();
    const maskImage = new Image();
    const whenLoaded = (img: HTMLImageElement) => new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });

    playerSprite.src = PLAYER_SPRITE;
    followerSprite.src = FOLLOWER_SPRITE;
    mapImage.src = MAP_IMAGE;
    maskImage.src = WALK_MASK;

    const loadWorkspaceFile = (path: string) =>
      new Promise<string>((res) => {
        fetch(path).then(r => r.ok ? r.blob() : null).then(blob => {
          if (!blob) { res(""); return; }
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = () => res("");
          reader.readAsDataURL(blob);
        }).catch(() => res(""));
      });

    Promise.all([whenLoaded(playerSprite), whenLoaded(followerSprite), whenLoaded(mapImage), whenLoaded(maskImage)]).then(async () => {
      if (!live) return;
      const offscreen = document.createElement("canvas");
      offscreen.width = maskImage.naturalWidth || 1006;
      offscreen.height = maskImage.naturalHeight || 774;
      const offCtx = offscreen.getContext("2d")!;
      offCtx.drawImage(maskImage, 0, 0);
      const baseMask = new Uint8ClampedArray(offCtx.getImageData(0, 0, offscreen.width, offscreen.height).data);
      let finalMaskData: Uint8ClampedArray = baseMask;

      const maskBase64 = await loadWorkspaceFile("/amity-square-mask.png");
      if (maskBase64) {
        const pubImg = new Image();
        await new Promise<void>((res) => { pubImg.onload = () => res(); pubImg.onerror = () => res(); pubImg.src = maskBase64; });
        const pubCanvas = document.createElement("canvas");
        pubCanvas.width = offscreen.width;
        pubCanvas.height = offscreen.height;
        pubCanvas.getContext("2d")!.drawImage(pubImg, 0, 0);
        finalMaskData = new Uint8ClampedArray(pubCanvas.getContext("2d")!.getImageData(0, 0, offscreen.width, offscreen.height).data);
      }

      try {
        const objsJson = await loadPublishedFile("/amity-square-objs.json");
        if (objsJson) {
          const objs = JSON.parse(objsJson);
          if (Array.isArray(objs) && objs.length > 0) interactObjsRef.current = objs;
        }
      } catch { /* use defaults */ }

      const tileGrid = buildTileGrid(finalMaskData, offscreen.width, offscreen.height);
      publishedTileDataRef.current = tileGrid;
      maskDataRef.current = finalMaskData;
      playerSpriteRef.current = playerSprite;
      followerSpriteRef.current = followerSprite;
      mapRef.current = mapImage;
      worldSizeRef.current = { w: mapImage.naturalWidth || 1006, h: mapImage.naturalHeight || 774 };

      const mW = mapImage.naturalWidth || 1006;
      const mH = mapImage.naturalHeight || 774;
      camRef.current = { x: clamp(START.x - VIEW_W / 2, 0, Math.max(0, mW - VIEW_W)), y: clamp(START.y - VIEW_H / 2, 0, Math.max(0, mH - VIEW_H)) };

      const startTX = Math.floor(START.x / TILE);
      const startTY = Math.floor(START.y / TILE);
      if (startTY >= 0 && startTY < GRID_H && startTX >= 0 && startTX < GRID_W && !tileGrid[startTY]?.[startTX]) {
        outer: for (let r = 1; r < 20; r++) {
          for (let angle = 0; angle < 360; angle += 30) {
            const rad = (angle * Math.PI) / 180;
            const tx = startTX + Math.round(r * Math.cos(rad));
            const ty = startTY + Math.round(r * Math.sin(rad));
            if (ty >= 0 && ty < GRID_H && tx >= 0 && tx < GRID_W && tileGrid[ty]?.[tx]) {
              playerRef.current = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
              followerRef.current = { x: playerRef.current.x - 28, y: playerRef.current.y + 10 };
              for (let i = 0; i < trailRef.current.length; i++) trailRef.current[i] = { ...playerRef.current };
              break outer;
            }
          }
        }
      }
      setReady(true);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => { showMaskRef.current = showMask; }, [showMask]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === " " || key === "enter") {
        e.preventDefault();
        if (dialogRef.current) {
          if (dialogIdx < dialogRef.current.length - 1) setDialogIdx(i => i + 1);
          else { setDialog(null); setDialogIdx(0); }
        } else {
          const px = Math.round(playerRef.current.x);
          const py = Math.round(playerRef.current.y);
          const nearby = interactObjsRef.current.find(o => Math.sqrt((o.x - px) ** 2 + (o.y - py) ** 2) < INTERACT_RADIUS);
          if (nearby) { setDialog(nearby.dialog); setDialogIdx(0); }
        }
        return;
      }
      const dir = keyToDir(key);
      if (!dir) return;
      e.preventDefault();
      keysRef.current.add(key);
      lastDirRef.current = dir;
      facingRef.current = dir;
    };
    const onUp = (e: KeyboardEvent) => {
      if (!keyToDir(e.key.toLowerCase())) return;
      e.preventDefault();
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const mapImage = mapRef.current;
    const playerSprite = playerSpriteRef.current;
    const followerSprite = followerSpriteRef.current;
    if (!canvas || !mapImage || !playerSprite || !followerSprite) return;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const { w: mW, h: mH } = worldSizeRef.current;
    const tileGrid = publishedTileDataRef.current!;

    const isTileWalkable = (tx: number, ty: number) => {
      if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
      return tileGrid[ty]?.[tx] ?? false;
    };
    const worldToTile = (wx: number, wy: number) => ({ tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE) });
    const isWorldWalkable = (wx: number, wy: number) => {
      const { tx, ty } = worldToTile(wx + SPRITE / 2, wy + SPRITE - 5);
      return isTileWalkable(tx, ty);
    };

    let raf = 0;
    let prev = 0;
    let walkClock = 0;
    let followerClock = 0;
    let hudClock = 0;

    const step = (time: number) => {
      const dt = Math.min(34, time - prev || 16);
      prev = time;
      const activeDir = chooseDir(keysRef.current, lastDirRef.current);
      let moving = false;

      if (activeDir) {
        const { dx, dy } = dirVector(activeDir);
        const stepSize = (MOVE_SPEED * dt) / 1000;
        const next = { x: playerRef.current.x + dx * stepSize, y: playerRef.current.y + dy * stepSize };
        if (isWorldWalkable(next.x, next.y)) {
          playerRef.current = next;
          moving = true;
          walkClock += dt;
        }
        facingRef.current = activeDir;
      }

      trailRef.current.push({ ...playerRef.current });
      if (trailRef.current.length > 160) trailRef.current.shift();
      const anchor = trailRef.current[Math.max(0, trailRef.current.length - FOLLOW_LAG)] ?? playerRef.current;
      followerRef.current = { x: followerRef.current.x + (anchor.x - followerRef.current.x) * FOLLOW_EASE, y: followerRef.current.y + (anchor.y - followerRef.current.y) * FOLLOW_EASE };
      const fdx = followerRef.current.x - (trailRef.current[trailRef.current.length - 2] ?? followerRef.current).x;
      const fdy = followerRef.current.y - (trailRef.current[trailRef.current.length - 2] ?? followerRef.current).y;
      if (Math.abs(fdx) > Math.abs(fdy) && Math.abs(fdx) > 0.1) followerFacingRef.current = fdx > 0 ? "right" : "left";
      else if (Math.abs(fdy) > 0.1) followerFacingRef.current = fdy > 0 ? "down" : "up";
      followerClock += dt;

      const targetCam = { x: clamp(playerRef.current.x - VIEW_W / 2 + 24, 0, Math.max(0, mW - VIEW_W)), y: clamp(playerRef.current.y - VIEW_H / 2 + 28, 0, Math.max(0, mH - VIEW_H)) };
      camRef.current = { x: camRef.current.x + (targetCam.x - camRef.current.x) * CAM_LERP, y: camRef.current.y + (targetCam.y - camRef.current.y) * CAM_LERP };
      const camX = Math.round(camRef.current.x);
      const camY = Math.round(camRef.current.y);

      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.drawImage(mapImage, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

      if (showMaskRef.current) {
        for (let ty = 0; ty < GRID_H; ty++) {
          for (let tx = 0; tx < GRID_W; tx++) {
            const screenX = Math.round(tx * TILE - camX);
            const screenY = Math.round(ty * TILE - camY);
            if (screenX < -TILE || screenX > VIEW_W + TILE || screenY < -TILE || screenY > VIEW_H + TILE) continue;
            const walkable = tileGrid[ty]?.[tx] ?? false;
            ctx.fillStyle = walkable ? "rgba(0,200,80,0.38)" : "rgba(220,40,40,0.38)";
            ctx.fillRect(screenX, screenY, TILE, TILE);
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(screenX, screenY, TILE, TILE);
          }
        }
      }

      const playerFrame = moving ? Math.floor(walkClock / 110) % 4 : 0;
      const followerFrame = Math.floor(followerClock / 180) % 2;
      const ps = { x: Math.round(playerRef.current.x - camX), y: Math.round(playerRef.current.y - camY) };
      const fs = { x: Math.round(followerRef.current.x - camX), y: Math.round(followerRef.current.y - camY) };
      const playerRow = facingRef.current === "down" ? 0 : facingRef.current === "up" ? 1 : facingRef.current === "left" ? 2 : 3;
      const followerRow = followerFacingRef.current === "down" ? 0 : followerFacingRef.current === "up" ? 1 : followerFacingRef.current === "left" ? 2 : 3;

      drawShadow(ctx, ps.x + SPRITE / 2, ps.y + SPRITE - 4);
      drawSprite(ctx, followerSprite, 0, 0, fs.x - 2, fs.y + 2, FOLLOWER_DRAW, FOLLOWER_DRAW, followerRow, followerFrame % 2);
      drawSprite(ctx, playerSprite, 0, 0, ps.x, ps.y - 2, PLAYER_DRAW, PLAYER_DRAW, playerRow, playerFrame);

      hudClock += dt;
      if (hudClock > 120) {
        hudClock = 0;
        const px = Math.round(playerRef.current.x);
        const py = Math.round(playerRef.current.y);
        const { tx, ty } = worldToTile(px, py);
        const walkable = isTileWalkable(tx, ty);
        setHud({ x: px, y: py, dir: facingRef.current, tileTX: tx, tileTY: ty, walkable });
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return (
    <div className="min-h-screen overflow-hidden text-white" style={{ background: "radial-gradient(circle at top,#173d20 0%,#102216 38%,#060709 100%)" }}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-4 p-4">
        <div className="flex w-full max-w-[900px] items-end justify-between gap-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.34em] text-emerald-200/70">Zo Space Recreation</div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Amity Square</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-100/70">Rebuilt around the original Platinum map art and movement footprint.</p>
          </div>
          <button type="button" onClick={() => setDebug(v => !v)} className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-medium tracking-wide text-white/85 backdrop-blur transition hover:bg-black/45">{debug ? "Hide debug" : "Show debug"}</button>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.55)]" style={{ width: VIEW_W, height: VIEW_H }}>
          <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="block" style={{ width: VIEW_W, height: VIEW_H, imageRendering: "pixelated" }} />
          {!ready && <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm text-white/80 backdrop-blur-sm">Loading Amity Square...</div>}
        </div>

        {dialog && (
          <div className="absolute bottom-0 left-0 right-0 cursor-pointer p-2" style={{ height: 80 }} onClick={() => { if (dialogIdx < dialog.length - 1) setDialogIdx(i => i + 1); else { setDialog(null); setDialogIdx(0); } }}>
            <div className="rounded-xl border border-white/40 bg-black/85 px-4 py-2 text-sm text-white shadow-xl backdrop-blur-sm">
              <div className="mb-1 text-xs text-yellow-300">💬 {dialog[dialogIdx]}</div>
              {dialog.length > 1 && <div className="text-xs text-white/50">▼ {dialogIdx + 1}/{dialog.length}</div>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-emerald-100/85">
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2">Move: WASD or arrows</div>
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2">Space/Enter: Interact</div>
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2">Pikachu follows Lucas</div>
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2">Editor: /amity-square-mask-editor</div>
        </div>

        {debug && (
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs text-emerald-100/80 shadow-lg backdrop-blur sm:grid-cols-4">
            <div>player: {hud.x}, {hud.y}</div>
            <div>tile: ({hud.tileTX}, {hud.tileTY})</div>
            <div>{hud.walkable ? "✅ walkable" : "🚫 blocked"}</div>
            <div>dir: {hud.dir}</div>
            <div className="col-span-4 flex items-center gap-4">
              <button type="button" onClick={() => setShowMask(v => !v)} className="rounded border border-white/20 bg-black/40 px-3 py-1.5 text-center text-white/80 hover:bg-black/60">{showMask ? "Hide grid" : "Show grid"}</button>
              <span className="inline-block h-3 w-3 rounded bg-green-500/60" /> walkable tile
              <span className="inline-block h-3 w-3 rounded bg-red-500/60" /> blocked tile
              <span className="ml-4 text-zinc-400">Editor: /amity-square-mask-editor</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}