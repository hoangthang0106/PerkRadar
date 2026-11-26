/** Presentation-only English labels.
 * Keep source IDs and Chinese category values unchanged in SQLite, API and filters.
 * This prevents breaking existing saved data when switching the user interface.
 */
import type { Category } from "./types";

const CATEGORY_LABELS: Record<Category, string> = {
  "免费白嫖": "Freebies",
  "限免": "Free for a Limited Time",
  "低价优惠": "Discounts",
  "会员订阅": "Memberships & Subscriptions",
  "游戏": "Games",
  "其他": "Other",
};

const SOURCE_LABELS: Record<string, string> = {
  linuxdo: "LINUX DO · Freebies",
  v2ex: "V2EX · Promotions",
  epic: "Epic Games",
  nodeseek: "NodeSeek",
  appinn: "Appinn · Software",
  ghxi: "GHXI · Software",
  iplaysoft: "iPlaySoft · Software",
};

export function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] ?? "Other";
}

export function sourceLabel(sourceId: string, fallback: string): string {
  return SOURCE_LABELS[sourceId] ?? fallback;
}
