import { useEffect, useRef, useState, useCallback } from "react";

type AmityConfig = {
  version: string;
  map: { w: number; h: number; tile: number; gridCols: number; gridRows: number };
  assets: { map: string; mask: string; objects: string };
  objectTypes: Record<string, { name: string; sprite: string; color: string }>;
};

export default function AmitySquareMaskEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<AmityConfig | null>(null);
  const [status, setStatus] = useState("Loading config…");
  const [brush, setBrush] = useState<0 | 1>(0);
  const [hoveredTile, setHoveredTile] = useState<{ tx: number; ty: number } | null>(null);
  const [objects, setObjects] = useState<Array<{ id: string; x: number; y: number; label: string; dialog: string[]; type: string }>>([]);
  const [objType, setObjType] = useState("npc");
  const [objLabel, setObjLabel] = useState("");
  const [objDialog, setObjDialog] = useState("");
  const [mode, setMode] = useState<"paint" | "objects">("paint");
  const paintingRef = useRef(false);
  const maskDataRef = useRef<Uint8ClampedArray | null>(null);
  const dimensionsRef = useRef({ w: 1006, h: 774 });
  const scaleRef = useRef(1);
  const viewOffsetRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const maskLoadedRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    fetch("/api/amity-square-config")
      .then(r => r.json())
      .then((cfg: AmityConfig) => {
        setConfig(cfg);
        dimensionsRef.current = { w: cfg.map.w, h: cfg.map.h };
        loadMask(cfg);
        loadObjects(cfg);
      })
      .catch(() => setStatus("Failed to load config — using defaults."));
  }, []);

  const loadMask = (cfg: AmityConfig) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { w, h } = dimensionsRef.current;
      const mc = document.createElement("canvas");
      mc.width = img.naturalWidth || w;
      mc.height = img.naturalHeight || h;
      mc.getContext("2d")!.drawImage(img, 0, 0);
      const raw = new Uint8ClampedArray(mc.getContext("2d")!.getImageData(0, 0, mc.width, mc.height).data);
      if (raw.length === mc.width * mc.height) {
        const rgba = new Uint8ClampedArray(mc.width * mc.height * 4);
        for (let i = 0; i < mc.width * mc.height; i++) {
          rgba[i * 4] = raw[i];
          rgba[i * 4 + 1] = raw[i];
          rgba[i * 4 + 2] = raw[i];
          rgba[i * 4 + 3] = 255;
        }
        maskDataRef.current = rgba;
      } else {
        maskDataRef.current = raw;
      }
      maskLoadedRef.current = maskDataRef.current;
      setStatus("Ready — paint the collision mask.");
      render();
    };
    img.onerror = () => {
      const { w, h } = dimensionsRef.current;
      const rgba = new Uint8ClampedArray(w * h * 4);
      rgba.fill(255);
      maskDataRef.current = rgba;
      maskLoadedRef.current = rgba;
      setStatus("No mask found — starting from all-walkable.");
      render();
    };
    img.src = "/amity-square-mask.png?" + Date.now();
  };

  const loadObjects = (cfg: AmityConfig) => {
    fetch(cfg.assets.objects)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.objects) setObjects(data.objects); })
      .catch(() => {});
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;
    const { w, h } = dimensionsRef.current;
    const TILE = config?.map.tile ?? 16;
    const sc = scaleRef.current;
    const offX = viewOffsetRef.current.x;
    const offY = viewOffsetRef.current.y;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mapImg = new Image();
    mapImg.crossOrigin = "anonymous";
    mapImg.src = config?.assets.map ?? "";
    if (mapImg.complete) {
      const cx = (canvas.width - w * sc) / 2 + offX;
      const cy = (canvas.height - h * sc) / 2 + offY;
      ctx.drawImage(mapImg, cx, cy, w * sc, h * sc);
    }

    const md = maskLoadedRef.current;
    if (!md) return;
    const mctx = maskCanvas.getContext("2d")!;
    mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

    const startTX = Math.max(0, Math.floor((-offX) / TILE));
    const startTY = Math.max(0, Math.floor((-offY) / TILE));
    const endTX = Math.ceil((canvas.width - offX) / TILE);
    const endTY = Math.ceil((canvas.height - offY) / TILE);

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const px = Math.round(tx * TILE * sc + (canvas.width - w * sc) / 2 + offX);
        const py = Math.round(ty * TILE * sc + (canvas.height - h * sc) / 2 + offY);
        if (px + TILE * sc < 0 || py + TILE * sc < 0 || px > canvas.width || py > canvas.height) continue;
        const mx = Math.min(tx * TILE + Math.floor(TILE / 2), w - 1);
        const my = Math.min(ty * TILE + Math.floor(TILE / 2), h - 1);
        const val = md[(my * w + mx) * 4];
        const walkable = val > 180;
        mctx.fillStyle = walkable ? "rgba(0,200,80,0.32)" : "rgba(220,40,40,0.40)";
        mctx.fillRect(px, py, Math.ceil(TILE * sc + 0.5), Math.ceil(TILE * sc + 0.5));
        mctx.strokeStyle = "rgba(255,255,255,0.18)";
        mctx.lineWidth = 0.5;
        mctx.strokeRect(px, py, Math.ceil(TILE * sc + 0.5), Math.ceil(TILE * sc + 0.5));
      }
    }

    const ht = hoveredTile;
    if (ht) {
      const hx = Math.round(ht.tx * TILE * sc + (canvas.width - w * sc) / 2 + offX);
      const hy = Math.round(ht.ty * TILE * sc + (canvas.height - h * sc) / 2 + offY);
      mctx.strokeStyle = brush === 0 ? "#00FF88" : "#FF4444";
      mctx.lineWidth = 2;
      mctx.strokeRect(hx, hy, Math.ceil(TILE * sc + 0.5), Math.ceil(TILE * sc + 0.5));
    }

    for (const obj of objects) {
      const ox = Math.round(obj.x / TILE * TILE * sc + (canvas.width - w * sc) / 2 + offX);
      const oy = Math.round(obj.y / TILE * TILE * sc + (canvas.height - h * sc) / 2 + offY);
      const objColor = config?.objectTypes[obj.type]?.color ?? "#CCCCCC";
      mctx.fillStyle = objColor;
      mctx.beginPath();
      mctx.arc(ox, oy, TILE * sc * 0.45, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = "white";
      mctx.lineWidth = 1.5;
      mctx.stroke();
      mctx.fillStyle = "white";
      mctx.font = `${Math.max(10, TILE * sc * 0.55)}px monospace`;
      mctx.textAlign = "center";
      mctx.fillText(obj.label || obj.type, ox, oy - TILE * sc * 0.55);
    }
  }, [config, hoveredTile, brush, objects]);

  const paintTile = useCallback((tx: number, ty: number, val: 0 | 1) => {
    const { w, h } = dimensionsRef.current;
    const TILE = config?.map.tile ?? 16;
    const md = maskDataRef.current;
    if (!md) return;
    const fillVal = val === 1 ? 0 : 255;
    for (let dy = 0; dy < TILE; dy++) {
      for (let dx = 0; dx < TILE; dx++) {
        const mx = tx * TILE + dx;
        const my = ty * TILE + dy;
        if (mx < 0 || my < 0 || mx >= w || my >= h) continue;
        const idx = (my * w + mx) * 4;
        md[idx] = fillVal; md[idx + 1] = fillVal; md[idx + 2] = fillVal; md[idx + 3] = 255;
      }
    }
    maskLoadedRef.current = md;
    render();
  }, [config, render]);

  const getTileFromEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return null;
    const { w, h } = dimensionsRef.current;
    const TILE = config.map.tile;
    const sc = scaleRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const offX = viewOffsetRef.current.x;
    const offY = viewOffsetRef.current.y;
    const tx = Math.floor((cx - (canvas.width - w * sc) / 2 - offX) / (TILE * sc));
    const ty = Math.floor((cy - (canvas.height - h * sc) / 2 - offY) / (TILE * sc));
    return { tx, ty };
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      paintingRef.current = true;
      if (mode === "paint") {
        const tile = getTileFromEvent(e as unknown as React.MouseEvent<HTMLCanvasElement>);
        if (tile) paintTile(tile.tx, tile.ty, brush);
      }
    };
    const onMove = (e: MouseEvent) => {
      const tile = getTileFromEvent(e as unknown as React.MouseEvent<HTMLCanvasElement>);
      if (!tile) { setHoveredTile(null); return; }
      setHoveredTile(tile);
      if (paintingRef.current && mode === "paint") paintTile(tile.tx, tile.ty, brush);
    };
    const onUp = () => { paintingRef.current = false; };
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onUp);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onUp);
    };
  }, [getTileFromEvent, paintTile, brush, mode]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const oldSc = scaleRef.current;
      const newSc = Math.max(1, Math.min(8, oldSc * (e.deltaY < 0 ? 1.1 : 0.9)));
      if (newSc === oldSc) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { w, h } = dimensionsRef.current;
      const cx = (canvas.width - w * oldSc) / 2 + viewOffsetRef.current.x;
      const cy = (canvas.height - h * oldSc) / 2 + viewOffsetRef.current.y;
      const wx = (mx - cx) / oldSc;
      const wy = (my - cy) / oldSc;
      scaleRef.current = newSc;
      viewOffsetRef.current = { x: mx - (canvas.width - w * newSc) / 2 - wx * newSc, y: my - (canvas.height - h * newSc) / 2 - wy * newSc };
      render();
    };
    const canvas = canvasRef.current;
    if (canvas) canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => { if (canvas) canvas.removeEventListener("wheel", onWheel); };
  }, [render]);

  const handleClearAll = () => {
    if (!confirm("Wipe the entire mask? All tiles become walkable. This cannot be undone.")) return;
    const { w, h } = dimensionsRef.current;
    const md = maskDataRef.current;
    if (!md) return;
    for (let i = 0; i < md.length; i += 4) { md[i] = md[i + 1] = md[i + 2] = 255; md[i + 3] = 255; }
    maskLoadedRef.current = md;
    render();
  };

  const handleExportJson = () => {
    const { w, h } = dimensionsRef.current;
    const md = maskDataRef.current;
    if (!md) return;
    const data = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        data.push(md[(y * w + x) * 4] > 180 ? 255 : 0);
      }
    }
    const blob = new Blob([JSON.stringify({ type: "amity-square-mask-v1", dimensions: { w, h }, data })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "amity-square-walk-mask.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePublish = async () => {
    const { w, h } = dimensionsRef.current;
    const md = maskDataRef.current;
    if (!md) return;
    setStatus("Publishing…");
    try {
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d")!.putImageData(new ImageData(md, w, h), 0, 0);
      const blob = await new Promise<Blob>((res, rej) => cv.toBlob(b => b ? res(b!) : rej(), "image/png"));
      const fd = new FormData();
      fd.append("mask", blob, "mask.png");
      fd.append("objects", JSON.stringify({ type: "amity-square-objs-v1", objects }, null, 2));
      const r = await fetch("/api/amity-square-publish", { method: "POST", body: fd });
      const j = await r.json();
      setStatus(j.ok ? `Published — mask=${j.saved?.mask}, objects=${j.saved?.objects}. Refresh the game.` : `Error: ${j.error}`);
    } catch (e: unknown) {
      setStatus(`Publish failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  useEffect(() => { if (config) render(); }, [config, objects, render]);

  const TILE = config?.map.tile ?? 16;
  const GRID_W = Math.ceil((config?.map.w ?? 1006) / TILE);
  const GRID_H = Math.ceil((config?.map.h ?? 774) / TILE);

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden bg-[#0b0f0b]" style={{ background: "radial-gradient(ellipse at 50% 40%,#111d11 0%,#080c08 100%)" }}>
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" style={{ imageRendering: "pixelated" }} />
      <canvas ref={maskCanvasRef} className="pointer-events-none absolute inset-0" style={{ imageRendering: "pixelated" }} />
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center gap-3 bg-black/70 px-4 py-2 text-xs text-white backdrop-blur">
        <span className="font-semibold tracking-wide text-emerald-300">Amity Square — Mask Editor</span>
        <span className="text-emerald-100/50">|</span>
        <span className="text-white/60">{config ? `${config.map.w}×${config.map.h} px  ·  ${TILE}px tiles  ·  ${GRID_W}×${GRID_H} grid` : status}</span>
        <span className="ml-auto text-emerald-100/50">Scroll to zoom · Drag to pan</span>
      </div>
      <div className="absolute left-4 top-14 z-10 flex flex-col gap-1">
        <button onClick={() => setMode("paint")} className={`rounded px-3 py-1.5 text-xs font-medium ${mode === "paint" ? "bg-emerald-700 text-white" : "bg-black/60 text-white/60 hover:bg-black/80"}`}>🎨 Paint</button>
        <button onClick={() => setMode("objects")} className={`rounded px-3 py-1.5 text-xs font-medium ${mode === "objects" ? "bg-emerald-700 text-white" : "bg-black/60 text-white/60 hover:bg-black/80"}`}>📍 Objects</button>
      </div>
      {mode === "paint" && (
        <div className="absolute right-4 top-14 z-10 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/75 p-3 text-xs text-white backdrop-blur">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Brush</div>
          <button onClick={() => setBrush(0)} className={`flex items-center gap-2 rounded px-3 py-1.5 ${brush === 0 ? "bg-emerald-700 ring-1 ring-emerald-400" : "bg-black/60 hover:bg-black/80"}`}><span className="h-4 w-4 rounded" style={{ background: "#00CC50" }} /> Walkable</button>
          <button onClick={() => setBrush(1)} className={`flex items-center gap-2 rounded px-3 py-1.5 ${brush === 1 ? "bg-red-800 ring-1 ring-red-400" : "bg-black/60 hover:bg-black/80"}`}><span className="h-4 w-4 rounded" style={{ background: "#CC3333" }} /> Blocked</button>
          <div className="text-[10px] uppercase tracking-widest text-white/40">Overlay</div>
          <div className="flex gap-2 text-[10px] text-white/60"><span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(0,200,80,0.5)" }} /> walkable <span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(220,40,40,0.5)" }} /> blocked</div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">Tools</div>
          <button onClick={handleClearAll} className="rounded bg-red-950 px-3 py-1.5 text-red-300 hover:bg-red-900">Wipe All</button>
          <button onClick={handleExportJson} className="rounded bg-black/60 px-3 py-1.5 text-white/70 hover:bg-black/80">Export JSON</button>
          <button onClick={handlePublish} className="mt-1 rounded bg-emerald-800 px-3 py-2 font-medium text-emerald-100 hover:bg-emerald-700">Publish to Game</button>
          {status.startsWith("Published") && <div className="text-emerald-400">✅ {status}</div>}
          {status.startsWith("Error") && <div className="text-red-400">{status}</div>}
          <div className="text-[10px] uppercase tracking-widest text-white/40">Config source</div>
          <div className="text-white/40">/api/amity-square-config</div>
        </div>
      )}
      {mode === "objects" && (
        <div className="absolute right-4 top-14 z-10 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/75 p-3 text-xs text-white backdrop-blur max-h-[70vh] overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Add Object</div>
          <select value={objType} onChange={e => setObjType(e.target.value)} className="rounded bg-black/60 px-2 py-1 text-white/80">
            {config && Object.entries(config.objectTypes).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
          <input value={objLabel} onChange={e => setObjLabel(e.target.value)} placeholder="Label (e.g. Nurse Joy)" className="rounded bg-black/60 px-2 py-1 text-white/80 placeholder-white/30" />
          <textarea value={objDialog} onChange={e => setObjDialog(e.target.value)} placeholder="Dialog lines (one per line)" rows={3} className="rounded bg-black/60 px-2 py-1 text-white/80 placeholder-white/30 text-xs" />
          <button onClick={() => { if (!objLabel.trim()) return; setObjects(prev => [...prev, { id: `obj-${Date.now()}`, x: 503, y: 387, label: objLabel.trim(), dialog: objDialog.split("\n").filter(l => l.trim()), type: objType }]); setObjLabel(""); setObjDialog(""); }} className="rounded bg-emerald-800 px-3 py-1.5 text-emerald-100 hover:bg-emerald-700">Add</button>
          <div className="text-[10px] uppercase tracking-widest text-white/40">Objects ({objects.length})</div>
          {objects.map((o, i) => (
            <div key={o.id} className="flex items-center gap-1 rounded bg-black/40 p-1.5">
              <span className="text-white/50">{i + 1}.</span>
              <span className="text-white/80">{o.label}</span>
              <span className="ml-auto text-white/30">({Math.round(o.x / TILE)}, {Math.round(o.y / TILE)})</span>
              <button onClick={() => setObjects(prev => prev.filter((_, j) => j !== i))} className="ml-1 rounded text-red-400/60 hover:text-red-300">✕</button>
            </div>
          ))}
          <button onClick={handlePublish} className="mt-1 rounded bg-emerald-800 px-3 py-2 font-medium text-emerald-100 hover:bg-emerald-700">Publish to Game</button>
        </div>
      )}
      <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-[10px] text-white/40 backdrop-blur">
        Config: <span className="text-emerald-300/60">/api/amity-square-config</span> · Game: <a href="/amity-square" className="text-emerald-300/60 hover:underline">/amity-square</a>
      </div>
    </div>
  );
}