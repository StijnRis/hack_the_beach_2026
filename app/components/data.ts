import type { ComponentType } from "react";
import {
  AlertIcon,
  HeartIcon,
  LeafIcon,
  TagIcon,
} from "./icons";

export type Lens = "sustainability" | "health" | "price" | "allergens";
export type Tier = "good" | "mid" | "bad";

type IconType = ComponentType<{ className?: string }>;

export const LENSES: {
  id: Lens;
  label: string;
  short: string;
  unit: string;
  icon: IconType;
}[] = [
  {
    id: "sustainability",
    label: "Sustainability",
    short: "Sustain.",
    unit: "Eco score",
    icon: LeafIcon,
  },
  {
    id: "health",
    label: "Health",
    short: "Health",
    unit: "Health score",
    icon: HeartIcon,
  },
  {
    id: "price",
    label: "Price",
    short: "Price",
    unit: "Value score",
    icon: TagIcon,
  },
  {
    id: "allergens",
    label: "Allergens",
    short: "Allergens",
    unit: "Allergen check",
    icon: AlertIcon,
  },
];

export const TIER_STYLE: Record<
    Tier,
    { dot: string; chipBg: string; chipText: string; label: string }
> = {
  good: {
    dot: "#3f7d4e",
    chipBg: "#e3efe2",
    chipText: "#2f6b3e",
    label: "Great",
  },
  mid: {
    dot: "#c8862a",
    chipBg: "#f6ecd8",
    chipText: "#8a5712",
    label: "Okay",
  },
  bad: {
    dot: "#b5483d",
    chipBg: "#f4ded9",
    chipText: "#8e2f26",
    label: "Poor",
  },
};

export type Product = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id: number;
  detection_id: string;
  productName: string | null;
  barcode: string | null;
  environmentScore: number;
};

/**
 * Dynamically resolves product performance metrics into visual ratings tiers
 * utilizing fallback proxies derived from raw pipeline data.
 */
export function tierOf(p: Product, lens: Lens): Tier {
  const score = p.environmentScore;

  if (lens === "sustainability") {
    if (score >= 60) return "good";
    if (score >= 30) return "mid";
    return "bad";
  }

  if (lens === "allergens") {
    return score > 40 ? "good" : "bad";
  }

  // Fallback proxy formulas for derived health and price lenses
  const derivedScore = lens === "health"
      ? Math.min(100, Math.max(0, score + 10))
      : Math.min(100, Math.max(0, 100 - score));

  if (derivedScore >= 60) return "good";
  if (derivedScore >= 30) return "mid";
  return "bad";
}

/**
 * Formats a clean string representation of the target metric value for UI badges.
 */
export function valueText(p: Product, lens: Lens): string {
  const score = p.environmentScore;

  if (lens === "sustainability") return `${score}/100`;
  if (lens === "allergens") return score > 40 ? "Safe" : "Warning";

  if (lens === "health") {
    return `${Math.min(100, Math.max(0, score + 10))}/100`;
  }

  // Price calculation
  return `${Math.min(100, Math.max(0, 100 - score))}/100`;
}

// Fallback dummy database template array for sample rendering
export const PRODUCTS: Product[] = [];