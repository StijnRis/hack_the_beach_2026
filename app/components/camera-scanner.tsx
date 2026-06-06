"use client";

import { ComponentType, useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
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
  valueText,
} from "./data";

type IconType = ComponentType<{ className?: string }>;
type Sheet = "none" | "detail" | "list";
type CamStatus = "init" | "live" | "nolive";

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

const TOP_SCRIM = "linear-gradient(to bottom, rgba(9,9,11,0.6), transparent)";
const BOTTOM_SCRIM = "linear-gradient(to top, rgba(9,9,11,0.8), rgba(9,9,11,0.2) 60%, transparent)";

function iconTint(id: Lens) {
  return id === "health"
      ? "text-rose-500"
      : id === "price"
          ? "text-slate-400"
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
      {s.label}
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

function getEcoColor(score: number, mode: "border" | "bg") {
  if (score >= 60) return mode === "border" ? "rgba(16, 185, 129, 0.85)" : "rgba(16, 185, 129, 0.15)";
  if (score >= 30) return mode === "border" ? "rgba(245, 158, 11, 0.85)" : "rgba(245, 158, 11, 0.15)";
  return mode === "border" ? "rgba(239, 68, 68, 0.85)" : "rgba(239, 68, 68, 0.15)";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [lens, setLens] = useState<Lens>("sustainability");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [flashOn, setFlashOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageDims, setImageDims] = useState({ width: 1, height: 1 });

  useEffect(() => {
    let cancelled = false;
    const md = navigator.mediaDevices;
    Promise.resolve()
        .then(() => {
          if (!md?.getUserMedia) throw new Error("no-getusermedia");
          return md.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        })
        .then(async (s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = s;
          const v = videoRef.current;
          if (v) {
            v.srcObject = s;
            await v.play().catch(() => {});
          }
          setStatus("live");
        })
        .catch(() => {
          if (!cancelled) setStatus("nolive");
        });
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
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
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

      const response = await fetch("/api/pipeline", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Pipeline processing structural crash.");
      }

      // 1:1 Mapping parsing matching your clean database structure exactly
      const parsedProducts: Product[] = (result.data || []).map((item: any) => {
        return {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          confidence: item.confidence,
          class: item.class,
          class_id: item.class_id,
          detection_id: item.detection_id,
          productName: item.productName === "null" ? null : item.productName,
          barcode: item.barcode === "null" ? null : item.barcode,
          environmentScore: typeof item.environmentScore === "number" ? item.environmentScore : 50,
        };
      });

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
      try {
        await track.applyConstraints({ advanced: [{ torch: next }] } as any);
      } catch {
        /* unsupported */
      }
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

  const openDetail = (id: string) => {
    setSelectedId(id);
    setSheet("detail");
  };

  const openList = () => {
    if (products.length === 0) return ping("Analyze a shelf first to generate listing views");
    setSheet((s) => (s === "list" ? "none" : "list"));
  };

  const rank: Record<Tier, number> = { good: 2, mid: 1, bad: 0 };
  const ranked = [...products].sort((a, b) => {
    const d = rank[tierOf(b, lens)] - rank[tierOf(a, lens)];
    if (d || lens === "allergens") return d;

    // Derived proxy fallback properties for local visualization matrices
    const scoreA = lens === "sustainability" ? a.environmentScore : 50;
    const scoreB = lens === "sustainability" ? b.environmentScore : 50;
    return scoreB - scoreA;
  });

  const selected = products.find((p) => p.detection_id === selectedId) ?? null;
  const meta = LENSES.find((l) => l.id === lens)!;

  return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950">
        <main
            className="relative w-full overflow-hidden bg-zinc-900
          text-zinc-100 select-none h-[100dvh] sm:my-5 sm:h-[880px]
          sm:w-[420px] sm:max-h-[calc(100dvh-2.5rem)]
          sm:rounded-[2.5rem] sm:border sm:border-zinc-800
          sm:shadow-2xl"
        >
          <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cx("absolute inset-0 h-full w-full object-cover", (photo || status !== "live") && "opacity-0")}
          />
          {!photo && status !== "live" && <Viewfinder />}
          {photo && (
              <img
                  ref={imageRef}
                  src={photo}
                  alt="Captured shelf"
                  onLoad={handleImageLoad}
                  className="absolute inset-0 h-full w-full object-cover animate-fade-in"
              />
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
                  {status === "live"
                      ? "Point at a shelf, then tap to scan"
                      : status === "init"
                          ? "Starting camera…"
                          : "Tap the shutter to take a photo"}
                </p>
                {status === "nolive" && (
                    <button
                        onClick={loadSample}
                        className="rounded-full bg-zinc-800/60 px-4 py-2 text-xs
                  font-medium text-zinc-200 border border-zinc-700/50
                  backdrop-blur-md transition active:scale-95 hover:bg-zinc-800"
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

          {/* ---- Bounding Rectangles Center Alignment Correction Layer ---- */}
          {photo && products.length > 0 && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                {products.map((p) => {
                  const widthPct = (p.width / imageDims.width) * 100;
                  const heightPct = (p.height / imageDims.height) * 100;

                  // Compute anchors based on box dimensions
                  const leftPct = ((p.x / imageDims.width) * 100) - (widthPct / 2);
                  const topPct = ((p.y / imageDims.height) * 100) - (heightPct / 2);

                  const currentScore = p.environmentScore;
                  const borderColor = getEcoColor(currentScore, "border");
                  const bgColor = getEcoColor(currentScore, "bg");
                  const isSelected = p.detection_id === selectedId;

                  return (
                      <button
                          key={p.detection_id}
                          onClick={() => openDetail(p.detection_id)}
                          style={{
                            left: `${Math.max(0, leftPct)}%`,
                            top: `${Math.max(0, topPct)}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                            borderColor: borderColor,
                            backgroundColor: bgColor,
                          }}
                          className={cx(
                              "absolute border-2 rounded-lg pointer-events-auto transition-all animate-fade-in group",
                              isSelected ? "ring-4 ring-white border-white scale-[1.02] z-20 shadow-2xl" : "hover:border-white z-10"
                          )}
                      >
                        <span
                            style={{ backgroundColor: borderColor }}
                            className="absolute -top-2 -left-2 text-[10px] font-bold text-zinc-950 px-1.5 py-0.5 rounded shadow border border-black/20 transform transition group-hover:scale-110"
                        >
                    {currentScore}
                  </span>
                      </button>
                  );
                })}
              </div>
          )}

          <div className="absolute inset-x-0 top-0 z-20 pt-[max(env(safe-area-inset-top),14px)]">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              {LENSES.map((l) => {
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
                      {active ? (
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                      ) : (
                          <Icon className={cx("h-3.5 w-3.5", iconTint(l.id))} />
                      )}
                      {l.label}
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

function DetailSheet({ product, lens, unit, onClose }: { product: Product; lens: Lens; unit: string; onClose: () => void }) {
  const t = tierOf(product, lens);
  const style = TIER_STYLE[t];
  const numeric = lens !== "allergens";

  // Dynamic fallback wrapper computing scores directly from environment metrics safely
  const score = numeric ? (lens === "sustainability" ? product.environmentScore : 50) : 0;

  return (
      <SheetShell onClose={onClose}>
        <div className="px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight text-zinc-100 truncate">
                {product.productName && product.productName !== "null" ? product.productName : `Detected Object`}
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
              <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{unit}</span>
              <span className="text-sm font-bold" style={{ color: style.chipText }}>{valueText(product, lens)}</span>
            </div>
            {numeric && (
                <div className="mt-3 h-2 rounded-full bg-zinc-800">
                  <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${score}%`, background: style.dot }} />
                </div>
            )}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300 font-normal">
            Detected object classification confidence rating is located at {(product.confidence * 100).toFixed(2)}%.
            Environmental Pipeline score is calculated to be {product.environmentScore}/100.
          </p>
        </div>
      </SheetShell>
  );
}

function ListSheet({ products, lens, label, onPick, onClose }: { products: Product[]; lens: Lens; label: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
      <SheetShell onClose={onClose}>
        <div className="flex items-center justify-between px-6">
          <div>
            <p className="text-md font-bold text-zinc-100">{products.length} Items Captured</p>
            <p className="text-xs text-zinc-400 mt-0.5">Organized by {label}</p>
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200">
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-4 max-h-[44dvh] overflow-y-auto px-4 pb-2 space-y-1">
          {products.map((p) => {
            const t = tierOf(p, lens);
            const score = lens === "sustainability" ? p.environmentScore : 50;
            return (
                <button
                    key={p.detection_id}
                    onClick={() => onPick(p.detection_id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition active:bg-zinc-800 hover:bg-zinc-800/50"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: TIER_STYLE[t].dot }} />
                  <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-200">
                  {p.productName && p.productName !== "null" ? p.productName : "Detected Item"}
                </span>
                <span className="block truncate text-xs text-zinc-400 mt-0.5">
                  {p.barcode && p.barcode !== "null" ? `Barcode: ${p.barcode}` : `Class: ${p.class}`}
                </span>
              </span>
                  {lens !== "allergens" && <span className="text-sm font-bold text-zinc-300 pr-1">{score}</span>}
                  <RatingChip tier={t} />
                </button>
            );
          })}
        </div>
      </SheetShell>
  );
}