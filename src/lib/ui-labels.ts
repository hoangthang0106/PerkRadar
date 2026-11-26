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

/** Convert server diagnostics to English in the UI without changing
 * persisted/source data, error matching rules, or existing API contracts.
 * Original deal titles and summaries are deliberately not machine-translated.
 */
export function diagnosticLabel(input: string): string {
  const exact: Record<string, string> = {
    "还没有完成任何一轮抓取，页面数据不能当作当前清单": "No collection has completed yet; results are not current.",
    "最近一轮已超过 4 小时，页面条目只能当历史抓取": "Last collection was over four hours ago; results may be historical.",
    "最近一轮已超过 2.5 小时，请先确认容器与刷新状态": "Last collection was over 2.5 hours ago; check container and refresh status.",
    "上一轮所有来源都失败": "All sources failed in the last collection.",
    "解析结构异常": "Unexpected feed structure",
    "解析条数骤降": "Sudden drop in parsed items",
    "抓取失败": "Source collection failed",
    "超时": "Timed out",
    "未能解析 RSS/Atom": "Unable to parse RSS/Atom feed",
    "未能从 Markdown 解析出条目": "Unable to extract items from Markdown",
    "返回内容不是 LINUX DO 福利列表，可能被阻断": "LINUX DO feed was blocked or returned unexpected content",
    "返回的是网页而不是订阅源，可能被阻断": "Feed was blocked or returned a webpage",
    "Epic 响应不是 JSON": "Invalid Epic API response",
    "Epic 响应缺少商品列表": "Epic API response contains no product list",
    "Epic 商品列表为空": "Epic returned an empty product list",
    "Epic 商品列表结构异常": "Unexpected Epic product structure",
    "Epic 商品列表促销结构异常": "Unexpected Epic promotion structure",
    "Epic 商品列表链接结构异常": "Unexpected Epic product link structure",
    "数据库不可读": "Database unavailable",
    "进程中断": "Process interrupted",
    "离线模式：未访问来源": "Offline mode: sources were not fetched",
    "拒绝跨站刷新": "Cross-site refresh request rejected",
    "请求无效": "Invalid request",
    "来源无效": "Invalid request origin",
  };
  if (exact[input]) return exact[input];
  let result = input;
  for (const [source, name] of Object.entries({
    "LINUX DO福利羊毛": "LINUX DO · Freebies",
    "V2EX推广": "V2EX · Promotions",
    "小众软件": "Appinn · Software",
    "果核剥壳": "GHXI · Software",
    "异次元软件世界": "iPlaySoft · Software",
  })) result = result.replaceAll(source, name);

  result = result
    .replace(/连续失败\s*(\d+)\s*轮/g, (_, count: string) => `${count} consecutive failures`)
    .replace(/解析条数从\s*(\d+)\s*降到\s*(\d+)/g, (_, from: string, to: string) => `parsed item count dropped from ${from} to ${to}`)
    .replace(/解析条数骤降至\s*(\d+)/g, (_, count: string) => `parsed item count dropped to ${count}`)
    .replace(/本轮成功但解析到\s*0\s*条/g, "successful collection, but no items were parsed")
    .replaceAll("解析结构异常", "unexpected feed structure")
    .replaceAll("抓取失败", "source collection failed")
    .replaceAll("超时", "timed out")
    .replaceAll("未能解析 RSS/Atom", "Unable to parse RSS/Atom feed");
  // The full upstream diagnostic remains available in container logs.
  return /[一-龥]/.test(result)
    ? "An upstream source returned an error; check container logs."
    : result;
}
