"use client";

import { ComponentType, useEffect, useRef, useState } from "react";
import {
  CloseIcon,
  FlashIcon,
  GalleryIcon,
  HistoryIcon,
  ListIcon,
  RotateIcon,
} from "./icons";
import {
  Lens,
  LENSES,
  PRODUCTS as INITIAL_PRODUCTS,
  Product,
  Tier,
  TIER_STYLE,
  tierOf,
} from "./data";

interface ExtendedProduct extends Product {
  nutriScore?: number | null;
  allergens?: string | null;
}

type IconType = ComponentType<{ className?: string }>;
type Sheet = "none" | "detail" | "list";
type CamStatus = "init" | "live" | "nolive";

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.description ?? o.label ?? o.type ?? "");
  }
  return String(v);
}

const TOP_SCRIM = "linear-gradient(to bottom, rgba(9,9,11,0.6), transparent)";
const BOTTOM_SCRIM = "linear-gradient(to top, rgba(9,9,11,0.8), rgba(9,9,11,0.2) 60%, transparent)";

function iconTint(id: Lens) {
  return id === "health"
      ? "text-rose-500"
      : id === "allergens"
          ? "text-amber-500"
          : "text-emerald-400";
}

function RatingChip({ tier }: { tier: Tier }) {
  const s = TIER_STYLE[tier];
  return (
      <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: s.chipBg, color: s.chipText }}
      >
      {asText(s.label)}
    </span>
  );
}

function ToolButton({
                      icon: Icon,
                      label,
                      onClick,
                      active,
                      dim,
                    }: {
  icon: IconType;
  label: string;
  onClick: () => void;
  active?: boolean;
  dim?: boolean;
}) {
  return (
      <button onClick={onClick} className="flex w-14 flex-col items-center gap-1.5 transition active:scale-90">
      <span
          className={cx(
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              "border backdrop-blur-md transition",
              active
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                  : "border-zinc-700/50 bg-zinc-900/60 text-zinc-300 hover:text-white",
              dim && "opacity-30 pointer-events-none"
          )}
      >
        <Icon className="h-[20px] w-[20px]" />
      </span>
        <span className={cx("text-[11px] font-medium tracking-wide text-zinc-400", dim && "opacity-30")}>
        {label}
      </span>
      </button>
  );
}

// Blends Red-Yellow-Green based on score criteria
function getScoreColor(score: number) {
  const t = Math.max(0, Math.min(100, score)) / 100;
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const u = t / 0.5;
    r = Math.round(220 + (245 - 220) * u);
    g = Math.round(38  + (158 - 38)  * u);
    b = Math.round(38  + (11  - 38)  * u);
  } else {
    const u = (t - 0.5) / 0.5;
    r = Math.round(245 + (16  - 245) * u);
    g = Math.round(158 + (185 - 158) * u);
    b = Math.round(11  + (129 - 11)  * u);
  }
  return `rgba(${r}, ${g}, ${b}, 0.95)`;
}

// Centralized dynamic style engine mapping values, colors, and layouts across lenses
function getDynamicValue(product: ExtendedProduct, lens: Lens): { score: number; label: string; hasBar: boolean; color: string } {
  if (lens === "sustainability") {
    const score = product.environmentScore ?? 50;
    return { score, label: `${score}/100`, hasBar: true, color: getScoreColor(score) };
  }

  if (lens === "health") {
    const rawScore = product.nutriScore;
    if (rawScore == null) return { score: 0, label: "Unknown", hasBar: false, color: "rgba(161, 161, 170, 0.95)" };

    let letter = "E";
    let scoreMapping = 10; // Red/E fallback
    if (rawScore <= 0) { letter = "A"; scoreMapping = 95; }
    else if (rawScore <= 2) { letter = "B"; scoreMapping = 75; }
    else if (rawScore <= 10) { letter = "C"; scoreMapping = 50; }
    else if (rawScore <= 18) { letter = "D"; scoreMapping = 30; }

    return {
      score: scoreMapping,
      label: `Nutri-Score ${letter}`,
      hasBar: true,
      color: getScoreColor(scoreMapping)
    };
  }

  if (lens === "allergens") {
    const value = product.allergens?.trim();
    const hasAllergens = value && value !== "null" && value.toLowerCase() !== "none";
    // Red if allergens present, otherwise clean green fallback
    const color = hasAllergens ? "rgba(239, 68, 68, 0.95)" : "rgba(52, 211, 153, 0.95)";
    return {
      score: 0,
      label: hasAllergens ? value : "None Detected",
      hasBar: false,
      color
    };
  }

  return { score: 50, label: "No Details", hasBar: false, color: "rgba(161, 161, 170, 0.95)" };
}

export default function CameraScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [status, setStatus] = useState<CamStatus>("init");
  const [photo, setPhoto] = useState<string | null>(null);
  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [lens, setLens] = useState<Lens>("sustainability");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [flashOn, setFlashOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageDims, setImageDims] = useState({ width: 1, height: 1 });

  const filteredLenses = LENSES.filter((l) => l.id !== "price");

  useEffect(() => {
    let cancelled = false;
    const md = navigator.mediaDevices;
    Promise.resolve()
        .then(() => {
          if (!md?.getUserMedia) throw new Error("no-getusermedia");
          return md.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        })
        .then(async (s) => {
          if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = s;
          const v = videoRef.current;
          if (v) { v.srcObject = s; await v.play().catch(() => {}); }
          setStatus("live");
        })
        .catch(() => { if (!cancelled) setStatus("nolive"); });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(id);
  }, [toast]);

  const ping = (msg: string) => setToast(msg);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (status === "live" && v && c && v.videoWidth) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(v, 0, 0, c.width, c.height);
        setPhoto(c.toDataURL("image/jpeg", 0.92));
        setProducts([]);
        setSheet("none");
        setSelectedId(null);
      }
      return;
    }
    camRef.current?.click();
  };

  const getBlobFromPhoto = async (photoUrl: string): Promise<Blob> => {
    if (photoUrl.startsWith("blob:")) {
      const res = await fetch(photoUrl);
      return await res.blob();
    }
    const arr = photoUrl.split(",");
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageDims({
        width: imageRef.current.naturalWidth || 1,
        height: imageRef.current.naturalHeight || 1,
      });
    }
  };

  const analyzeShelf = async () => {
    if (!photo) return;
    if (photo === "/schap.jpeg") {
      setIsAnalyzing(true);
      setTimeout(() => {
        setProducts(INITIAL_PRODUCTS);
        setIsAnalyzing(false);
        ping("Sample analyzed successfully!");
      }, 1500);
      return;
    }
    try {
      setIsAnalyzing(true);
      ping("Analyzing shelf image...");
      const imageBlob = await getBlobFromPhoto(photo);
      const formData = new FormData();
      formData.append("image", imageBlob, "captured_shelf.jpg");
      const response = await fetch("/api/pipeline", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Pipeline processing structural crash.");
      const parsedProducts: ExtendedProduct[] = (result.data || []).map((item: any) => ({
        x: item.x, y: item.y, width: item.width, height: item.height,
        confidence: item.confidence, class: item.class, class_id: item.class_id,
        detection_id: item.detection_id,
        productName: item.productName === "null" ? null : item.productName,
        barcode: item.barcode === "null" ? null : item.barcode,
        environmentScore: typeof item.environmentScore === "number" ? item.environmentScore : 50,
        nutriScore: item.nutriScore !== undefined ? item.nutriScore : null,
        allergens: item.allergens !== undefined ? item.allergens : null,
      }));
      setProducts(parsedProducts);
      ping(`Success! Loaded ${parsedProducts.length} live items.`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "An error occurred while analyzing the shelf.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSample = () => {
    setPhoto("/schap.jpeg");
    setProducts([]);
    setSheet("none");
    setSelectedId(null);
  };

  const retake = () => {
    if (photo?.startsWith("blob:")) URL.revokeObjectURL(photo);
    setPhoto(null);
    setProducts([]);
    setSheet("none");
    setSelectedId(null);
  };

  const toggleFlash = async () => {
    const next = !flashOn;
    setFlashOn(next);
    const track = streamRef.current?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
    if (track && caps?.torch) {
      try { await track.applyConstraints({ advanced: [{ torch: next }] } as any); } catch {}
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photo?.startsWith("blob:")) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(f));
    setProducts([]);
    setSheet("none");
    setSelectedId(null);
    e.target.value = "";
  };

  const openDetail = (id: string) => { setSelectedId(id); setSheet("detail"); };
  const openList = () => {
    if (products.length === 0) return ping("Analyze a shelf first to generate listing views");
    setSheet((s) => (s === "list" ? "none" : "list"));
  };

  const rank: Record<Tier, number> = { good: 2, mid: 1, bad: 0 };
  const ranked = [...products].sort((a, b) => {
    const d = rank[tierOf(b, lens)] - rank[tierOf(a, lens)];
    if (d || lens === "allergens") return d;
    const scoreA = getDynamicValue(a, lens).score;
    const scoreB = getDynamicValue(b, lens).score;
    return scoreB - scoreA;
  });

  const selected = products.find((p) => p.detection_id === selectedId) ?? null;
  const meta = filteredLenses.find((l) => l.id === lens) || filteredLenses[0];

  const maxScore = products.length > 0 ? Math.max(...products.map((p) => p.environmentScore ?? 0)) : -1;
  const bestEcoId = maxScore >= 0 ? products.find((p) => p.environmentScore === maxScore)?.detection_id : null;

  return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950">
        <style>{`
          @keyframes goldCirclePulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.95;
              box-shadow: 0 0 10px 3px rgba(245, 158, 11, 0.7);
            }
            50% {
              transform: scale(1.6);
              opacity: 0.1;
              box-shadow: 0 0 20px 6px rgba(245, 158, 11, 0.2);
            }
          }
        `}</style>

        <main
            className="relative w-full overflow-hidden bg-zinc-900
          text-zinc-100 select-none h-[100dvh] sm:my-5 sm:h-[880px]
          sm:w-[420px] sm:max-h-[calc(100dvh-2.5rem)]
          sm:rounded-[2.5rem] sm:border sm:border-zinc-800
          sm:shadow-2xl flex flex-col justify-center"
        >
          {!photo && (
              <video
                  ref={videoRef}
                  autoPlay muted playsInline
                  className={cx("absolute inset-0 h-full w-full object-cover", status !== "live" && "opacity-0")}
              />
          )}
          {!photo && status !== "live" && <Viewfinder />}

          {photo && (
              <div
                  style={{ aspectRatio: `${imageDims.width} / ${imageDims.height}` }}
                  className="relative w-full max-h-full mx-auto overflow-hidden animate-fade-in flex items-center justify-center"
              >
                <img
                    ref={imageRef}
                    src={photo}
                    alt="Captured shelf"
                    onLoad={handleImageLoad}
                    className="w-full h-full object-contain"
                />

                {products.length > 0 && (
                    <div className="absolute inset-0 z-10 pointer-events-none">
                      {products.map((p) => {
                        const isBest = p.detection_id === bestEcoId;
                        const isSelected = p.detection_id === selectedId;

                        const cxPct = (p.x / imageDims.width)  * 100 - (p.width  / imageDims.width)  * 100 / 2;
                        const cyPct  = (p.y / imageDims.height) * 100 - (p.height / imageDims.height) * 100 / 2;

                        // Dynamic colors configured relative to the active lens context choice
                        const { color: mappedLensColor } = getDynamicValue(p, lens);

                        return (
                            <button
                                key={p.detection_id}
                                onClick={() => openDetail(p.detection_id)}
                                style={{
                                  left: `${cxPct}%`,
                                  top: `${cyPct}%`,
                                  width: "10px",
                                  height: "10px",
                                  transform: "translate(-50%, -50%)",
                                }}
                                className={cx(
                                    "absolute rounded-full border border-white bg-white pointer-events-auto",
                                    "flex items-center justify-center transition-all shadow-sm shadow-black/40",
                                    isSelected
                                        ? "ring-2 ring-emerald-400 scale-125 z-30"
                                        : isBest
                                            ? "scale-110 border-amber-400 z-20"
                                            : "hover:scale-125 hover:z-20 z-10"
                                )}
                            >
                              <span
                                  className="w-1.5 h-1.5 rounded-full transition-colors duration-300 block shrink-0"
                                  style={{ backgroundColor: mappedLensColor }}
                              />

                              {isBest && (
                                  <div
                                      style={{
                                        position: "absolute",
                                        inset: "-1px",
                                        border: "3px solid #fbbf24",
                                        borderRadius: "100%",
                                        pointerEvents: "none",
                                        zIndex: -1,
                                        animation: "goldCirclePulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                                      }}
                                  />
                              )}
                            </button>
                        );
                      })}
                    </div>
                )}
              </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 z-10" style={{ background: TOP_SCRIM }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 z-10" style={{ background: BOTTOM_SCRIM }} />

          {isAnalyzing && (
              <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold tracking-wide text-emerald-400">Processing Pipeline Data...</p>
              </div>
          )}

          {!photo && (
              <div className="absolute inset-x-0 bottom-44 z-20 flex flex-col items-center gap-3 px-8 text-center">
                <p className="text-[13px] font-medium text-zinc-300">
                  {status === "live" ? "Point at a shelf, then tap to scan" : status === "init" ? "Starting camera…" : "Tap the shutter to take a photo"}
                </p>
                {status === "nolive" && (
                    <button
                        onClick={loadSample}
                        className="rounded-full bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-200 border border-zinc-700/50 backdrop-blur-md transition active:scale-95 hover:bg-zinc-800"
                    >
                      Use a sample shelf
                    </button>
                )}
              </div>
          )}

          {photo && products.length === 0 && !isAnalyzing && (
              <div className="absolute inset-x-0 bottom-44 z-20 flex flex-col items-center px-8 text-center">
                <p className="text-[13px] font-semibold text-zinc-200 bg-zinc-900/90 px-4 py-2 rounded-full border border-zinc-800 shadow-md backdrop-blur-md">
                  Tap "Analyse Shelf" to detect items
                </p>
              </div>
          )}

          <div className="absolute inset-x-0 top-0 z-20 pt-[max(env(safe-area-inset-top),14px)]">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              {filteredLenses.map((l) => {
                const active = l.id === lens;
                const Icon = l.icon;
                return (
                    <button
                        key={l.id}
                        onClick={() => setLens(l.id)}
                        className={cx(
                            "flex shrink-0 items-center gap-1.5 rounded-full",
                            "px-4 py-2 text-xs font-semibold shadow-md border",
                            "transition active:scale-95",
                            active
                                ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                                : "bg-zinc-900/80 text-zinc-300 border-zinc-800/80 backdrop-blur-md"
                        )}
                    >
                      {/* Kept original original category icon even when item is selected/active */}
                      <Icon className={cx("h-3.5 w-3.5", active ? "text-zinc-900" : iconTint(l.id))} />
                      {asText(l.label)}
                    </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-2 px-4">
              {photo && products.length > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full bg-zinc-900/80 border border-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {products.length} products found
              </span>
              )}
              {photo === "/schap.jpeg" && (
                  <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                Sample Template
              </span>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]">
            <div className="flex items-center justify-between">
              {photo ? (
                  <ToolButton icon={RotateIcon} label="Retake" onClick={retake} />
              ) : (
                  <ToolButton icon={FlashIcon} label="Flash" onClick={toggleFlash} active={flashOn} />
              )}
              <ToolButton icon={GalleryIcon} label="Gallery" onClick={() => galleryRef.current?.click()} />

              {photo && products.length === 0 ? (
                  <button
                      onClick={analyzeShelf}
                      disabled={isAnalyzing}
                      className="h-14 px-5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold tracking-wider rounded-2xl shadow-xl transition-all border border-emerald-500/30 shrink-0"
                  >
                    ANALYSE SHELF
                  </button>
              ) : (
                  <button
                      onClick={capture}
                      disabled={isAnalyzing}
                      aria-label="Capture snapshot"
                      className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full transition active:scale-95 group disabled:opacity-40"
                  >
                    <span className="absolute inset-0 rounded-full border-[3px] border-zinc-400/30 group-hover:border-zinc-300/50 transition" />
                    <span className="h-14 w-14 rounded-full bg-white transition group-active:scale-90 shadow-md" />
                  </button>
              )}

              <ToolButton icon={ListIcon} label="List View" onClick={openList} dim={products.length === 0} />
              <ToolButton icon={HistoryIcon} label="History" onClick={() => ping("History coming soon")} />
            </div>
          </div>

          {toast && (
              <div className="absolute inset-x-0 bottom-32 z-50 flex justify-center animate-fade-in">
            <span className="rounded-full bg-zinc-900/90 border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 backdrop-blur-md shadow-xl">
              {toast}
            </span>
              </div>
          )}

          {sheet === "detail" && selected && (
              <DetailSheet product={selected} lens={lens} unit={meta.unit} onClose={() => setSheet("none")} />
          )}
          {sheet === "list" && (
              <ListSheet products={ranked} lens={lens} label={meta.label} onPick={openDetail} onClose={() => setSheet("none")} />
          )}

          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </main>
      </div>
  );
}

function Viewfinder() {
  const corner = "absolute h-6 w-6 border-zinc-700";
  return (
      <div className="absolute inset-0 bg-zinc-950">
        <div className="absolute inset-12 sm:inset-16 transition-all duration-300">
          <span className={cx(corner, "left-0 top-0 rounded-tl-xl border-l-2 border-t-2")} />
          <span className={cx(corner, "right-0 top-0 rounded-tr-xl border-r-2 border-t-2")} />
          <span className={cx(corner, "bottom-0 left-0 rounded-bl-xl border-b-2 border-l-2")} />
          <span className={cx(corner, "bottom-0 right-0 rounded-br-xl border-b-2 border-r-2")} />
        </div>
      </div>
  );
}

function SheetShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
      <>
        <button aria-label="Close sheet" onClick={onClose} className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs animate-fade-in" />
        <div className="absolute inset-x-0 bottom-0 z-40 animate-sheet-up rounded-t-[2rem] bg-zinc-900 border-t border-zinc-800/80 pt-3 text-zinc-100 shadow-2xl pb-[max(env(safe-area-inset-bottom),20px)]">
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-zinc-700" />
          {children}
        </div>
      </>
  );
}

function DetailSheet({ product, lens, unit, onClose }: { product: ExtendedProduct; lens: Lens; unit: string; onClose: () => void }) {
  const t = tierOf(product, lens);

  // Destructure lens-specific rendering attributes dynamically
  const { score, label: lensValueText, hasBar, color: currentLensColor } = getDynamicValue(product, lens);

  return (
      <SheetShell onClose={onClose}>
        <div className="px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight text-zinc-100 truncate">
                {product.productName && product.productName !== "null" ? product.productName : "Detected Object"}
              </p>
              <p className="text-xs font-medium text-zinc-400 mt-0.5">
                {product.barcode && product.barcode !== "null" ? `Barcode: ${product.barcode}` : `Unknown Class (${product.class})`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <RatingChip tier={t} />
              <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200">
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-zinc-950 border border-zinc-800/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{asText(unit)}</span>
              {/* Dynamic value color configuration matching active choice parameters */}
              <span className="text-sm font-bold transition-colors duration-300" style={{ color: currentLensColor }}>
                {lensValueText}
              </span>
            </div>
            {hasBar && (
                <div className="mt-3 h-2 rounded-full bg-zinc-800">
                  {/* Progress tracker shifting background dynamically relative to computed scores */}
                  <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${score}%`, background: currentLensColor }}
                  />
                </div>
            )}
          </div>
        </div>
      </SheetShell>
  );
}

function ListSheet({ products, lens, label, onPick, onClose }: { products: ExtendedProduct[]; lens: Lens; label: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
      <SheetShell onClose={onClose}>
        <div className="flex items-center justify-between px-6">
          <div>
            <p className="text-md font-bold text-zinc-100">{products.length} Items Captured</p>
            <p className="text-xs text-zinc-400 mt-0.5">Organized by {asText(label)}</p>
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200">
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-4 max-h-[44dvh] overflow-y-auto px-4 pb-2 space-y-1">
          {products.map((p) => {
            const t = tierOf(p, lens);
            const { label: lensValueText, color: currentLensColor } = getDynamicValue(p, lens);
            return (
                <button
                    key={p.detection_id}
                    onClick={() => onPick(p.detection_id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition active:bg-zinc-800 hover:bg-zinc-800/50"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: currentLensColor }} />
                  <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-200">
                  {p.productName && p.productName !== "null" ? p.productName : "Detected Item"}
                </span>
                <span className="block truncate text-xs text-zinc-400 mt-0.5">
                  {p.barcode && p.barcode !== "null" ? `Barcode: ${p.barcode}` : `Class: ${p.class}`}
                </span>
              </span>
                  <span className="text-xs font-bold pr-1 truncate max-w-[100px]" style={{ color: currentLensColor }}>
                    {lensValueText}
                  </span>
                  <RatingChip tier={t} />
                </button>
            );
          })}
        </div>
      </SheetShell>
  );
}