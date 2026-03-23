import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatNumber(num: number | null | undefined, decimals = 2): string {
  if (num == null) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function getSignalColors(signal: string) {
  const s = signal.toUpperCase();
  if (s.includes("BUY")) return "text-success bg-success/10 border-success/20";
  if (s.includes("SELL")) return "text-destructive bg-destructive/10 border-destructive/20";
  return "text-muted-foreground bg-muted/20 border-muted/30";
}

export function getSignalTextColor(signal: string) {
  const s = signal.toUpperCase();
  if (s.includes("BUY")) return "text-success";
  if (s.includes("SELL")) return "text-destructive";
  return "text-muted-foreground";
}
