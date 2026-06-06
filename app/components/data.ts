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
  id: string;
  name: string;
  brand: string;
  x: number;
  y: number;
  scores: {
    sustainability: number;
    health: number;
    price: number;
    allergens: "ok" | "warn" | "alert";
  };
  note: string;
  detail: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Oat & Honey Bar",
    brand: "GrainField",
    x: 17,
    y: 28,
    scores: { sustainability: 82, health: 71, price: 64, allergens: "ok" },
    note: "No major allergens",
    detail: "Whole-oat base in a recyclable wrapper.",
  },
  {
    id: "p2",
    name: "Choc Chip B'tween",
    brand: "B'tween",
    x: 41,
    y: 23,
    scores: { sustainability: 46, health: 36, price: 81, allergens: "warn" },
    note: "May contain milk",
    detail: "Cheap and tasty, but high in added sugar.",
  },
  {
    id: "p3",
    name: "Cocoa Orange",
    brand: "Nakd",
    x: 66,
    y: 27,
    scores: { sustainability: 88, health: 84, price: 51, allergens: "ok" },
    note: "Made in a nut-free line",
    detail: "Dates and cocoa, nothing else. Plant-based.",
  },
  {
    id: "p4",
    name: "Berry Punch'd",
    brand: "Punch'd",
    x: 29,
    y: 54,
    scores: { sustainability: 34, health: 43, price: 72, allergens: "alert" },
    note: "Contains peanuts",
    detail: "Mixed-plastic wrapper that is hard to recycle.",
  },
  {
    id: "p5",
    name: "Cocoa Oat Flapjack",
    brand: "TREK",
    x: 55,
    y: 51,
    scores: { sustainability: 74, health: 78, price: 57, allergens: "ok" },
    note: "No major allergens",
    detail: "Protein-rich oats, B-corp certified maker.",
  },
  {
    id: "p6",
    name: "Salted Protein Pot",
    brand: "Fuel Co",
    x: 81,
    y: 57,
    scores: { sustainability: 41, health: 66, price: 46, allergens: "warn" },
    note: "May contain soya",
    detail: "Good protein, but a pricey single-use pot.",
  },
  {
    id: "p7",
    name: "Malt Loaf Slice",
    brand: "Soreen",
    x: 21,
    y: 78,
    scores: { sustainability: 69, health: 53, price: 87, allergens: "ok" },
    note: "No major allergens",
    detail: "Low fat and great value per gram.",
  },
  {
    id: "p8",
    name: "Seeded Oat Bar",
    brand: "The Food Co",
    x: 62,
    y: 80,
    scores: { sustainability: 90, health: 72, price: 39, allergens: "ok" },
    note: "No major allergens",
    detail: "Compostable wrapper, locally milled oats.",
  },
];

export function tierOf(p: Product, lens: Lens): Tier {
  if (lens === "allergens") {
    const a = p.scores.allergens;
    return a === "ok" ? "good" : a === "warn" ? "mid" : "bad";
  }
  const v = p.scores[lens];
  return v >= 70 ? "good" : v >= 45 ? "mid" : "bad";
}

export function valueText(p: Product, lens: Lens): string {
  if (lens === "allergens") return p.note;
  return `${p.scores[lens]} / 100`;
}
