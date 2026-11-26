"use client";

import "../components/deal-board.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="perk-board" data-testid="error">
      <div className="board-error">
        <div className="board-error-card" role="alert">
          <h1>Deals are temporarily unavailable</h1>
          <p>The page failed to load. No sample deals are substituted; retry to load actual results from the server.</p>
          <button type="button" onClick={reset} className="board-refresh" data-testid="error-retry" suppressHydrationWarning>Try again</button>
        </div>
      </div>
    </div>
  );
}
