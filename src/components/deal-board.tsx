"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  Info,
  LogOut,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AuthExpiredError, readBoard, expireBoard } from "@/lib/board-client";
import { loadPersonal, loadShowAll, STORAGE_KEY, SHOW_ALL_KEY, LEGACY_STORAGE_KEY, LEGACY_SHOW_ALL_KEY, type Personal } from "@/lib/personal-storage";
import { filterDeals, type DealSort } from "@/lib/filter-deals";
import { normalizeBoardState } from "@/lib/board-view";
import { CATEGORIES, type BoardState, type Category, type DealDTO, type SourceStatus } from "@/lib/types";
import "./deal-board.css";
import { categoryLabel, diagnosticLabel, sourceLabel } from "@/lib/ui-labels";

const emptyPersonal: Personal = { claimed: [], favorites: [] };
type Alert = { text: string; role: "status" | "alert"; testId: string };

function readError(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("error" in data)) return null;
  const value = (data as { error?: unknown }).error;
  return typeof value === "string" ? value : null;
}

function formatSourceQuality(source: SourceStatus): string {
  const quality = source.quality;
  if (!quality) return "";
  if (quality.warning) return `; quality warning: ${diagnosticLabel(quality.warning)}`;
  if (quality.consecutiveFailures && quality.consecutiveFailures >= 3) return `; ${quality.consecutiveFailures} consecutive failures`;
  if (quality.structureAnomaly) return "; unexpected feed structure";
  if (quality.countDrop) return "; sudden drop in parsed items";
  return "";
}

function formatSourceOutcome(source: SourceStatus): string {
  const diagnostic = source.diagnostic === "missing_key" ? "; Jina key missing; anonymous requests may be rate limited" : source.diagnostic === "rate_limited" ? "; rate limited, backing off" : source.diagnostic === "circuit_open" ? "; waiting for recovery" : source.diagnostic === "structure_anomaly" ? "; unexpected upstream response" : "";
  const quality = formatSourceQuality(source) + diagnostic;
  if (source.lastOk == null) return `Not fetched yet${quality}`;
  if (source.lastOk) return `Success: ${source.lastFetched ?? 0} fetched, ${source.lastInserted ?? 0} new${quality}`;
  return `Failed (${source.lastError ? diagnosticLabel(source.lastError) : "reason not recorded"}); retrying next run${quality}`;
}

function formatFailure(failure: { sourceId: string; sourceName: string; error: string }): string {
  return `${sourceLabel(failure.sourceId, failure.sourceName)} (${diagnosticLabel(failure.error)})`;
}

/**
 * 正式首页：服务端给初始快照，客户端挂载后展开，保留真实数据和本机状态。
 * authEnabled 为真时显示「退出」，并在会话过期后把人送回登录页。
 */
export function DealBoard({ initial, authEnabled = false }: { initial: BoardState; authEnabled?: boolean }) {
  const [board, setBoard] = useState<BoardState>(() => normalizeBoardState(initial) ?? initial);
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState<string | "all">("all");
  const [category, setCategory] = useState<Category | "all" | "favorites">("all");
  const [onlyNew, setOnlyNew] = useState(false);
  // 默认显示全部；尊重迁移后的偏好，搜索时不隐藏其他。
  const [showAllLeads, setShowAllLeads] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [sort, setSort] = useState<DealSort>("newest");
  const [personal, setPersonal] = useState<Personal>(emptyPersonal);
  const [personalReady, setPersonalReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setBoard(normalizeBoardState(initial) ?? initial);
  }, [initial]);

  useEffect(() => {
    try {
      setShowAllLeads(loadShowAll(localStorage));
      setPersonal(loadPersonal(localStorage));
    } catch { setStorageError("Browser storage unavailable; changes last only on this page."); }
    setPersonalReady(true);
    // 另一个标签页改动本机状态后，重新读取，避免旧内存覆盖新值。
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY && event.key !== SHOW_ALL_KEY && event.key !== LEGACY_STORAGE_KEY && event.key !== LEGACY_SHOW_ALL_KEY) return;
      if (event.key === null || (event.key === SHOW_ALL_KEY || event.key === LEGACY_SHOW_ALL_KEY)) setShowAllLeads(loadShowAll(localStorage));
      if (event.key !== SHOW_ALL_KEY) {
        try { setPersonal((previous) => loadPersonal(localStorage, previous)); } catch { /* retain memory */ }
        setPersonalReady(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight: AbortController | null = null;
    const tick = async () => {
      if (stopped || document.visibilityState === "hidden" || inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const next = await readBoard(controller.signal);
        if (!stopped) { setBoard(next); setPollError(false); }
      } catch (error) {
        if (stopped) return;
        // 会话过期后继续轮询只会一直 401；直接回登录页，收藏和已领在本机存储里不受影响。
        if (error instanceof AuthExpiredError) { stopped = true; window.location.assign("/login"); return; }
        setPollError(true);
      }
      finally { clearTimeout(timeout); inFlight = null; }
    };
    const onVisible = () => { if (document.visibilityState !== "hidden") void tick(); };
    void tick();
    const timer = setInterval(() => { setBoard((previous) => expireBoard(previous, Date.now())); void tick(); }, 30_000);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; inFlight?.abort(); clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  function savePersonal(next: Personal) {
    setPersonal(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError(null);
    } catch {
      // 隐私模式或配额满时，状态和存储必须显式说明不一致，而不是静默成功。
      setStorageError("Could not save favorites or claimed items to this browser. Changes last only on this page.");
    }
  }

  function saveShowAll(next: boolean) {
    setShowAllLeads(next);
    try {
      localStorage.setItem(SHOW_ALL_KEY, next ? "1" : "0");
    } catch {
      // 展示偏好写入失败只影响下次打开；当前页面仍按用户选择展示。
    }
  }

  function toggle(list: "claimed" | "favorites", canonicalUrl: string) {
    const latest = personal;
    const current = new Set(latest[list]);
    if (current.has(canonicalUrl)) current.delete(canonicalUrl);
    else current.add(canonicalUrl);
    savePersonal({ ...latest, [list]: [...current] });
  }

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/refresh", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(35_000) });
      const data: unknown = await response.json().catch(() => null);
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (!response.ok) {
        setMessage(readError(data) || "Refresh did not complete");
        return;
      }
      const safe = normalizeBoardState(data);
      if (!safe) {
        setMessage("Invalid refresh result; current list kept.");
        return;
      }
      setBoard({ ...safe, refreshInProgress: false });
      setPollError(false);
    } catch {
      setMessage("Network error; refresh did not complete.");
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    try {
      await fetch("/api/session", { method: "DELETE", cache: "no-store" });
    } catch {
      // 断网时 cookie 清不掉；仍然回登录页，会话最迟 8 小时后自行过期。
    }
    window.location.assign("/login");
  }

  function resetFilters() {
    setSourceId("all");
    setCategory("all");
    setQuery("");
    setOnlyNew(false);
    saveShowAll(true);
    setSort("newest");
  }

  const claimedSet = new Set(personal.claimed);
  const favoriteSet = new Set(personal.favorites);
  // 「其他」只在默认的「全部」视图隐藏；显式选分类或收藏时仍按用户选择展示。
  const hideOther = !showAllLeads && category === "all" && !query.trim();
  const filters = { query, sourceId, category, onlyNew, sort, includeOther: !hideOther };
  const matching =
    category === "favorites" && !personalReady
      ? []
      : filterDeals(board.deals, { ...filters, includeOther: true }, personal);
  const visible =
    category === "favorites" && !personalReady
      ? []
      : filterDeals(board.deals, filters, personal);
  const hiddenOtherCount = hideOther ? matching.filter((item) => item.category === "其他").length : 0;
  const waitingForFirst = !board.lastUpdatedAt && (board.refreshInProgress || refreshing);
  const busy = refreshing || board.refreshInProgress;
  const activeFilters = [sourceId !== "all", category !== "all", query.trim().length > 0, onlyNew, sort !== "newest"].filter(Boolean).length;

  const statusItems = [
    { label: "Last updated", value: board.lastUpdatedLabel ? `${board.lastUpdatedLabel} (UTC+8)` : "Not yet", testId: "status-update" },
    { label: "Sources OK", value: `${board.sourceHealth.ok}/${board.sourceHealth.total}`, testId: "status-sources" },
    { label: "Active items", value: String(board.activeCount), testId: "status-active" },
    { label: "New this run", value: String(board.newCount), testId: "status-new" },
    { label: "Next update", value: board.nextRefreshLabel ? `${board.nextRefreshLabel} (UTC+8)` : "Not scheduled", testId: "status-next" },
  ];

  const alerts: Alert[] = [];
  if (board.freshness?.stale) alerts.push({ text: "Data may be outdated. Check source collection status.", role: "status", testId: "stale" });
  if (pollError) alerts.push({ text: "Live data is temporarily unavailable. Showing the last results; this page will update when service recovers.", role: "status", testId: "poll-error" });
  if (storageError) alerts.push({ text: storageError, role: "alert", testId: "storage-error" });
  if (message) alerts.push({ text: message, role: "alert", testId: "refresh-message" });
  if (board.anomalies?.length) alerts.push({ text: `Data notices: ${board.anomalies.map(diagnosticLabel).join("; ")}`, role: "status", testId: "anomalies" });
  if (board.failures.length) alerts.push({ text: `Sources failed; will retry: ${board.failures.map(formatFailure).join(", ")}`, role: "status", testId: "failures" });

  const categoryCounts = new Map<string, number>();
  for (const deal of board.deals) {
    categoryCounts.set(deal.category, (categoryCounts.get(deal.category) ?? 0) + 1);
  }

  const emptyMessage =
    category === "favorites" && !personalReady
      ? "Loading favorites from this browser."
      : pollError && board.deals.length === 0
        ? "Data temporarily unavailable; results will update after recovery. No sample deals are shown."
        : board.deals.length === 0
          ? board.lastUpdatedAt
            ? "No items collected this run. Failed sources will retry; no sample deals are shown."
            : "The server has not finished collecting. The empty list reflects actual results."
          : hiddenOtherCount > 0 && visible.length === 0
            ? "Only hidden Other items match. Turn on Show all items."
            : "No items match the current filters.";

  if (!mounted) return <div className="perk-board" data-testid="board-root"><div className="board-loading" role="status" data-testid="loading">Opening…</div></div>;

  return (
    <div className="perk-board" data-testid="board-root">
      <div className="demo-shell">
        <header className="demo-header" data-testid="header">
          <Link className="demo-brand" href="/" data-testid="brand"><Radar aria-hidden="true" />PerkRadar</Link>
          <div className="demo-header-actions">
            <Button className="board-refresh" data-testid="refresh" onClick={refresh} disabled={busy} aria-busy={busy}>
              <RefreshCw aria-hidden="true" />{busy ? "Refreshing…" : "Refresh now"}
            </Button>
            {authEnabled ? (
              <Button variant="ghost" data-testid="sign-out" onClick={signOut}><LogOut aria-hidden="true" />Sign out</Button>
            ) : null}
          </div>
        </header>

        <div className="board-alert-strip" data-testid="alerts" aria-live="polite">
          <span className="board-lead-note" data-testid="lead-note"><ShieldCheck aria-hidden="true" />Public-feed listings are not verified for validity, eligibility or availability.</span>
          {alerts.map((alert) => <p key={alert.testId} className="board-alert" role={alert.role} data-testid={alert.testId}>{alert.text}</p>)}
        </div>

        <div className="demo-layout">
          <aside className="demo-sidebar" aria-label="Search and filters" data-testid="sidebar">
            <button className="demo-filter-toggle" type="button" aria-expanded={mobileFiltersOpen} aria-controls="demo-filter-body" data-testid="filter-toggle" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}>
              <SlidersHorizontal aria-hidden="true" />Search and filters{activeFilters ? <span className="demo-filter-count">{activeFilters}</span> : null}<ChevronDown aria-hidden="true" />
            </button>
            <div id="demo-filter-body" className="demo-filter-body" data-open={mobileFiltersOpen ? "true" : "false"}>
              <div className="demo-sidebar-head"><h2>Filters</h2><Button className="demo-reset" variant="ghost" size="sm" data-testid="reset" onClick={resetFilters}>Reset</Button></div>

              <form className="demo-search" role="search" onSubmit={(event) => event.preventDefault()}>
                <label className="sr-only" htmlFor="deal-search">Search titles</label>
                <Input id="deal-search" type="search" data-testid="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search software, tools or keywords…" />
                <Button type="submit" size="icon" aria-label="Search deals"><Search aria-hidden="true" /></Button>
              </form>

              <section className="demo-filter-group" aria-label="Sort">
                <h3>Sort</h3>
                <select className="board-sort" data-testid="sort" aria-label="Sort order" value={sort} onChange={(event) => setSort(event.target.value as DealSort)}>
                  <option value="newest">Newest first</option>
                  <option value="expiring">Expiring soon</option>
                </select>
              </section>

              <section className="demo-filter-group" aria-label="Filter by source">
                <h3>Sources</h3>
                <div className="demo-filter-row">
                  <Pill pressed={sourceId === "all"} testId="source-chip" onClick={() => setSourceId("all")}>All sources<span>{board.activeCount}</span></Pill>
                  {board.sources.map((source) => (
                    <Pill key={source.id} pressed={sourceId === source.id} testId="source-chip" onClick={() => setSourceId(source.id)}>{sourceLabel(source.id, source.name)}<span>{source.activeCount}</span></Pill>
                  ))}
                </div>
              </section>

              <section className="demo-filter-group" aria-label="Filter by category">
                <h3>Categories</h3>
                <div className="demo-filter-row">
                  <Pill pressed={category === "all"} testId="category-chip" onClick={() => setCategory("all")}>All</Pill>
                  {CATEGORIES.map((item) => (
                    <Pill key={item} pressed={category === item} testId="category-chip" onClick={() => setCategory(item)}>{categoryLabel(item)}<span>{categoryCounts.get(item) ?? 0}</span></Pill>
                  ))}
                  <Pill pressed={category === "favorites"} testId="category-chip" onClick={() => setCategory(category === "favorites" ? "all" : "favorites")}><Bookmark aria-hidden="true" />My favorites<span>{personalReady ? favoriteSet.size : 0}</span></Pill>
                </div>
              </section>

              <section className="board-status" aria-label="Collection status">
                <h3>Status</h3>
                <dl className="board-status-list" data-testid="stats">
                  {statusItems.map((item) => <StatusItem key={item.label} label={item.label} value={item.value} testId={item.testId} />)}
                </dl>
              </section>

              <details className="board-source-results" data-testid="source-results">
                <summary><Info aria-hidden="true" />Results by source</summary>
                <ul>
                  {board.sources.map((source) => <li key={source.id}>{sourceLabel(source.id, source.name)}: {formatSourceOutcome(source)}</li>)}
                </ul>
              </details>
              <p className="board-footer-note" data-testid="footer-note">All items come from public feeds and have not been individually verified.</p>
            </div>
          </aside>

          <main className="demo-content" data-testid="content">
            <div className="demo-results-heading" data-testid="results-heading">
              <h1>Deals and offers</h1>
              <span className="board-results-count" role="status" data-testid="visible-count">{visible.length} items</span>
              {hiddenOtherCount > 0 ? (
                <span className="board-hidden-note" role="status" data-testid="hidden-note">Hidden: {hiddenOtherCount} Other items</span>
              ) : null}
              <div className="demo-results-actions">
                <label className="demo-new-toggle demo-results-toggle">
                  <input type="checkbox" data-testid="show-all" checked={showAllLeads} onChange={(event) => saveShowAll(event.target.checked)} />
                  <span className="demo-switch" aria-hidden="true" />Show all items
                </label>
                <label className="demo-new-toggle demo-results-toggle">
                  <input type="checkbox" data-testid="only-new" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />
                  <span className="demo-switch" aria-hidden="true" />New items only
                </label>
              </div>
            </div>

            {waitingForFirst ? <p className="board-empty-note" role="status">Collecting deals for the first time…</p> : null}

            <section className="demo-cards" aria-label="Deals list" data-testid="cards">
              {visible.slice(0, displayLimit).map((deal) => (
                <DealCard
                  key={deal.canonicalUrl}
                  deal={deal}
                  claimed={personalReady && claimedSet.has(deal.canonicalUrl)}
                  favorite={personalReady && favoriteSet.has(deal.canonicalUrl)}
                  onClaim={() => toggle("claimed", deal.canonicalUrl)}
                  onFavorite={() => toggle("favorites", deal.canonicalUrl)}
                />
              ))}
            </section>

            <p role="status" data-testid="display-range">Showing {Math.min(displayLimit, visible.length)} / {visible.length} matches ({board.deals.length} loaded)</p>
            {visible.length > displayLimit ? <Button onClick={() => setDisplayLimit((value) => value + 100)}>Show 100 more</Button> : null}
            {visible.length === 0 ? (
              <div className="demo-empty" data-testid="empty-state" role="status">
                <Search aria-hidden="true" />
                <h2>No items to display</h2>
                <p className="board-empty-note">{emptyMessage}</p>
                <Button variant="outline" onClick={resetFilters}>Clear filters</Button>
              </div>
            ) : null}

            <footer className="demo-footer" data-testid="footer">
              <p className="board-footer-note">All categories are shown by default. Disable Show all items to hide Other; searching always includes Other.</p>
              <p className="board-footer-note">Items without expiry dates remain for seven days after publication. Expired items are removed when their deadline passes.</p>
              <p className="board-footer-note">New items were first recorded in the latest successful run. Failed sources do not overwrite saved entries.</p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, value, testId }: { label: string; value: string; testId: string }) {
  return <div className="board-status-item" data-testid={testId}><dt>{label}</dt><dd>{value}</dd></div>;
}

function Pill({ pressed, onClick, children, testId }: { pressed: boolean; onClick: () => void; children: ReactNode; testId: string }) {
  return (
    <Button className="demo-pill" variant={pressed ? "default" : "outline"} aria-pressed={pressed} data-testid={testId} onClick={onClick}>
      {children}
    </Button>
  );
}

function DealCard({ deal, claimed, favorite, onClaim, onFavorite }: { deal: DealDTO; claimed: boolean; favorite: boolean; onClaim: () => void; onFavorite: () => void }) {
  return (
    <article className="demo-deal" data-claimed={claimed ? "true" : "false"} data-new={deal.isNew ? "true" : "false"} data-testid="deal-card" aria-label={deal.title}>
      <div className="deal-heading">
        <h2 data-testid="deal-title">{deal.title}</h2>
        <Button variant="ghost" className="demo-favorite" size="icon" data-testid="favorite" aria-label={`${favorite ? "Remove from favorites" : "Add to favorites"}: ${deal.title}`} aria-pressed={favorite} onClick={onFavorite}>
          <Bookmark aria-hidden="true" /><span>{favorite ? "Saved" : "Save"}</span>
        </Button>
      </div>

      <div className="deal-summary">
        <span>Summary · Original</span>
        <p data-testid="deal-summary">{deal.summary || "The original source did not provide a summary."}</p>
      </div>

      <details className="deal-original" data-testid="deal-original">
        <summary>Original source details</summary>
        <div className="board-original-meta" data-testid="deal-meta">
          {deal.publishedLabel ? <span><Clock3 aria-hidden="true" />Published {deal.publishedLabel}</span> : null}
          {deal.expiresLabel ? <span><Clock3 aria-hidden="true" />Expires {deal.expiresLabel}</span> : null}
          <span>Source: {sourceLabel(deal.sourceId, deal.sourceName)}</span>
          <span>Category: {categoryLabel(deal.category)}</span>
        </div>
      </details>

      <div className="deal-tags">
        {deal.isNew ? <span className="deal-fresh" data-testid="deal-new">New this run</span> : null}
        <Badge variant="secondary" data-testid="deal-category">{categoryLabel(deal.category)}</Badge>
        <Badge variant="outline" data-testid="deal-source">{sourceLabel(deal.sourceId, deal.sourceName)}</Badge>
        {deal.expiresLabel ? <Badge variant={deal.expiresSoon ? "destructive" : "outline"} data-testid="deal-expiry">{deal.expiresSoon ? "Ending soon" : "Expires"} {deal.expiresLabel}</Badge> : null}
        {claimed ? <span className="deal-claimed-state" data-testid="deal-claimed">Marked claimed</span> : null}
      </div>

      <div className="deal-actions">
        <Button asChild>
          <a href={deal.url} target="_blank" rel="noopener noreferrer" data-testid="open-original">Open original<ArrowUpRight data-icon="inline-end" /></a>
        </Button>
        <Button variant="outline" data-testid="claim" aria-pressed={claimed} onClick={onClaim}>
          <Check data-icon="inline-start" />{claimed ? "Undo claimed" : "Mark claimed"}
        </Button>
      </div>
    </article>
  );
}
