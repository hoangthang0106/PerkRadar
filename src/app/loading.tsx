import "../components/deal-board.css";

export default function Loading() {
  return (
    <div className="perk-board">
      <div className="board-loading" role="status" data-testid="loading">Loading the latest results from the server…</div>
    </div>
  );
}
