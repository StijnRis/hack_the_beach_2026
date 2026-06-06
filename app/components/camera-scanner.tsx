"use client";

import {
  ComponentType,
  useEffect,
  useRef,
  useState,
} from "react";
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
  PRODUCTS,
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

const SPHERE =
  "radial-gradient(120% 120% at 35% 28%, #94b07c 0%," +
  " #5c7b4d 46%, #3c5337 100%)";
const TOP_SCRIM =
  "linear-gradient(to bottom, rgba(22,20,15,.55), transparent)";
const BOTTOM_SCRIM =
  "linear-gradient(to top, rgba(22,20,15,.74)," +
  " rgba(22,20,15,.18) 55%, transparent)";

function iconTint(id: Lens) {
  return id === "health"
    ? "text-rose-500"
    : id === "price"
      ? "text-slate-500"
      : id === "allergens"
        ? "text-amber-500"
        : "text-[#46604a]";
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
    <button
      onClick={onClick}
      className="flex w-14 flex-col items-center gap-1 transition
        active:scale-90"
    >
      <span
        className={cx(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          "border backdrop-blur-sm transition",
          active
            ? "border-amber-300/70 bg-amber-300/25 text-amber-200"
            : "border-white/15 bg-white/10 text-[#efe9da]",
          dim && "opacity-40"
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span
        className={cx(
          "text-[11px] font-medium text-[#efe9da]",
          dim && "opacity-40"
        )}
      >
        {label}
      </span>
    </button>
  );
}

export default function CameraScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CamStatus>("init");
  const [photo, setPhoto] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>("sustainability");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [flashOn, setFlashOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const md = navigator.mediaDevices;
    Promise.resolve()
      .then(() => {
        // The in-app live preview uses getUserMedia, which only exists
        // in a secure context (https / localhost). When it is missing
        // we fall back to the phone's native camera via a file input —
        // that works fine over plain http, no certificates needed.
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
        setSheet("none");
        setSelectedId(null);
      }
      return;
    }
    // No live preview: open the device's native camera. The capture
    // attribute makes mobile browsers launch the camera over plain http.
    camRef.current?.click();
  };

  const loadSample = () => {
    setPhoto("/schap.jpeg");
    setSheet("none");
    setSelectedId(null);
  };

  const retake = () => {
    if (photo?.startsWith("blob:")) URL.revokeObjectURL(photo);
    setPhoto(null);
    setSheet("none");
    setSelectedId(null);
  };

  const toggleFlash = async () => {
    const next = !flashOn;
    setFlashOn(next);
    const track = streamRef.current?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.() as
      | { torch?: boolean }
      | undefined;
    if (track && caps?.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: next }],
        } as unknown as MediaTrackConstraints);
      } catch {
        /* torch unsupported — visual toggle only */
      }
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photo?.startsWith("blob:")) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(f));
    setSheet("none");
    setSelectedId(null);
    e.target.value = "";
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setSheet("detail");
  };

  const openList = () => {
    if (!photo) return ping("Scan a shelf first");
    setSheet((s) => (s === "list" ? "none" : "list"));
  };

  const rank: Record<Tier, number> = { good: 2, mid: 1, bad: 0 };
  const ranked = [...PRODUCTS].sort((a, b) => {
    const d = rank[tierOf(b, lens)] - rank[tierOf(a, lens)];
    if (d || lens === "allergens") return d;
    return b.scores[lens] - a.scores[lens];
  });

  const selected = PRODUCTS.find((p) => p.id === selectedId) ?? null;
  const meta = LENSES.find((l) => l.id === lens)!;

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center
        bg-[#16140f]"
    >
      <main
        className="relative w-full overflow-hidden bg-[#2a2620]
          text-white select-none h-[100dvh] sm:my-5 sm:h-[880px]
          sm:w-[420px] sm:max-h-[calc(100dvh-2.5rem)]
          sm:rounded-[2.6rem] sm:border sm:border-white/10
          sm:shadow-2xl"
      >
        {/* ---- camera / photo layer ---- */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cx(
            "absolute inset-0 h-full w-full object-cover",
            (photo || status !== "live") && "opacity-0"
          )}
        />
        {!photo && status !== "live" && <Viewfinder />}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Captured shelf"
            className="absolute inset-0 h-full w-full
              object-cover animate-fade-in"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* ---- scrims ---- */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: TOP_SCRIM }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0
            h-56"
          style={{ background: BOTTOM_SCRIM }}
        />

        {/* ---- live scanning hint ---- */}
        {!photo && status === "live" && (
          <div
            className="pointer-events-none absolute left-8 right-8
              h-[2px] rounded-full animate-scanline"
            style={{
              background:
                "linear-gradient(90deg, transparent," +
                " rgba(180,210,160,.9), transparent)",
              boxShadow: "0 0 14px 2px rgba(150,190,120,.5)",
            }}
          />
        )}
        {!photo && (
          <div
            className="absolute inset-x-0 bottom-44 z-10 flex flex-col
              items-center gap-3 px-8 text-center"
          >
            <p className="text-[13px] font-medium text-white/80">
              {status === "live"
                ? "Point at a shelf, then tap to scan"
                : status === "init"
                  ? "Starting camera…"
                  : "Tap the shutter to take a photo"}
            </p>
            {status === "nolive" && (
              <button
                onClick={loadSample}
                className="rounded-full bg-white/12 px-4 py-2 text-xs
                  font-medium text-[#efe9da] ring-1 ring-white/20
                  backdrop-blur-sm transition active:scale-95"
              >
                Use a sample shelf
              </button>
            )}
          </div>
        )}

        {/* ---- detection dots ---- */}
        {photo && (
          <div className="absolute inset-0">
            {PRODUCTS.map((p, i) => {
              const t = tierOf(p, lens);
              const color = TIER_STYLE[t].dot;
              const on = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => openDetail(p.id)}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  className="absolute grid h-7 w-7 -translate-x-1/2
                    -translate-y-1/2 place-items-center"
                >
                  <span
                    className="absolute h-6 w-6 rounded-full
                      animate-scan-pulse"
                    style={{
                      background: color,
                      animationDelay: `${i * 0.18}s`,
                    }}
                  />
                  <span
                    className={cx(
                      "relative grid h-7 w-7 place-items-center",
                      "rounded-full bg-white shadow-md animate-pop-in",
                      "transition", on && "ring-2 ring-white scale-110"
                    )}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: color }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ---- top: lens tabs + status ---- */}
        <div
          className="absolute inset-x-0 top-0 z-20
            pt-[max(env(safe-area-inset-top),14px)]"
        >
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
                    "px-4 py-2 text-sm font-semibold shadow-sm",
                    "transition active:scale-95",
                    active
                      ? "bg-[#46604a] text-white"
                      : "bg-[#f7f2e9]/90 text-[#2c2a24]"
                  )}
                >
                  {active ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <Icon className={cx("h-4 w-4", iconTint(l.id))} />
                  )}
                  {l.label}
                </button>
              );
            })}
          </div>

          <div
            className="mt-2 flex items-center justify-center gap-2 px-4"
          >
            {photo && (
              <span
                className="flex items-center gap-1.5 rounded-full
                  bg-[#3b372e]/75 px-3 py-1 text-xs font-medium
                  text-[#f1ece0] backdrop-blur-sm"
              >
                <span className="h-2 w-2 rounded-full bg-[#7fae66]" />
                {PRODUCTS.length} products · tap a dot for details
              </span>
            )}
            {photo === "/schap.jpeg" && (
              <span
                className="rounded-full bg-amber-400/20 px-2.5 py-1
                  text-xs font-medium text-amber-200 ring-1
                  ring-amber-300/40"
              >
                Sample
              </span>
            )}
          </div>
        </div>

        {/* ---- bottom toolbar ---- */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 px-5 pt-3
            pb-[max(env(safe-area-inset-bottom),18px)]"
        >
          <div className="flex items-end justify-between">
            {photo ? (
              <ToolButton
                icon={RotateIcon}
                label="Retake"
                onClick={retake}
              />
            ) : (
              <ToolButton
                icon={FlashIcon}
                label="Flash"
                onClick={toggleFlash}
                active={flashOn}
              />
            )}
            <ToolButton
              icon={GalleryIcon}
              label="Gallery"
              onClick={() => galleryRef.current?.click()}
            />
            <button
              onClick={capture}
              aria-label="Scan shelf"
              className="relative grid h-[78px] w-[78px] shrink-0
                place-items-center rounded-full transition
                active:scale-95"
            >
              <span
                className="absolute inset-0 rounded-full
                  border-[3px] border-white/90"
              />
              <span
                className="h-[60px] w-[60px] rounded-full shadow-inner"
                style={{ background: SPHERE }}
              />
            </button>
            <ToolButton
              icon={ListIcon}
              label="List"
              onClick={openList}
              dim={!photo}
            />
            <ToolButton
              icon={HistoryIcon}
              label="History"
              onClick={() => ping("History — coming soon")}
            />
          </div>
        </div>

        {/* ---- toast ---- */}
        {toast && (
          <div
            className="absolute inset-x-0 bottom-32 z-50 flex
              justify-center animate-fade-in"
          >
            <span
              className="rounded-full bg-black/80 px-4 py-2 text-sm
                font-medium text-white"
            >
              {toast}
            </span>
          </div>
        )}

        {/* ---- detail sheet ---- */}
        {sheet === "detail" && selected && (
          <DetailSheet
            product={selected}
            lens={lens}
            unit={meta.unit}
            onClose={() => setSheet("none")}
          />
        )}

        {/* ---- list sheet ---- */}
        {sheet === "list" && (
          <ListSheet
            products={ranked}
            lens={lens}
            label={meta.label}
            onPick={openDetail}
            onClose={() => setSheet("none")}
          />
        )}

        {/* native camera (shutter) — opens the camera on mobile */}
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPick}
        />
        {/* photo library (Gallery) */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
      </main>
    </div>
  );
}

function Viewfinder() {
  const corner = "absolute h-8 w-8 border-white/30";
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 32%, #3a352c 0%," +
          " #211e18 72%)",
      }}
    >
      <div className="absolute inset-10 sm:inset-12">
        <span
          className={cx(corner, "left-0 top-0 rounded-tl-2xl",
            "border-l-2 border-t-2")}
        />
        <span
          className={cx(corner, "right-0 top-0 rounded-tr-2xl",
            "border-r-2 border-t-2")}
        />
        <span
          className={cx(corner, "bottom-0 left-0 rounded-bl-2xl",
            "border-b-2 border-l-2")}
        />
        <span
          className={cx(corner, "bottom-0 right-0 rounded-br-2xl",
            "border-b-2 border-r-2")}
        />
      </div>
    </div>
  );
}

function SheetShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 z-30 bg-black/35 animate-fade-in"
      />
      <div
        className="absolute inset-x-0 bottom-0 z-40 animate-sheet-up
          rounded-t-3xl bg-[#f7f2e9] pt-3 text-[#2c2a24] shadow-2xl
          pb-[max(env(safe-area-inset-bottom),18px)]"
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15"
        />
        {children}
      </div>
    </>
  );
}

function DetailSheet({
  product,
  lens,
  unit,
  onClose,
}: {
  product: Product;
  lens: Lens;
  unit: string;
  onClose: () => void;
}) {
  const t = tierOf(product, lens);
  const style = TIER_STYLE[t];
  const numeric = lens !== "allergens";
  const score = numeric ? product.scores[lens] : 0;
  return (
    <SheetShell onClose={onClose}>
      <div className="px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-semibold leading-tight">
              {product.name}
            </p>
            <p className="text-sm text-black/55">{product.brand}</p>
          </div>
          <div className="flex items-center gap-2">
            <RatingChip tier={t} />
            <button
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-full
                bg-black/5 text-black/50"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/70 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-black/55">
              {unit}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: style.chipText }}
            >
              {valueText(product, lens)}
            </span>
          </div>
          {numeric && (
            <div className="mt-2 h-2 rounded-full bg-black/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${score}%`, background: style.dot }}
              />
            </div>
          )}
        </div>

        <p className="mt-3.5 text-sm leading-relaxed text-black/70">
          {product.detail}
        </p>
      </div>
    </SheetShell>
  );
}

function ListSheet({
  products,
  lens,
  label,
  onPick,
  onClose,
}: {
  products: Product[];
  lens: Lens;
  label: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetShell onClose={onClose}>
      <div className="flex items-center justify-between px-5">
        <div>
          <p className="text-[17px] font-semibold leading-tight">
            {products.length} products
          </p>
          <p className="text-xs text-black/50">Ranked by {label}</p>
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full
            bg-black/5 text-black/50"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 max-h-[46dvh] overflow-y-auto px-3 pb-1">
        {products.map((p) => {
          const t = tierOf(p, lens);
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="flex w-full items-center gap-3 rounded-2xl
                px-2 py-2.5 text-left transition active:bg-black/5"
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ background: TIER_STYLE[t].dot }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {p.name}
                </span>
                <span className="block truncate text-xs text-black/50">
                  {p.brand}
                </span>
              </span>
              {lens !== "allergens" && (
                <span className="text-sm font-semibold text-black/55">
                  {p.scores[lens]}
                </span>
              )}
              <RatingChip tier={t} />
            </button>
          );
        })}
      </div>
    </SheetShell>
  );
}
