/**
 * StatsPanel — overlay showing connection status, driver count, and debug controls.
 */

/**
 * @param {{ status: string, driverCount: number, stats: object, cellCount: number, showHexGrid: boolean, onToggleHexGrid: function }} props
 */
export function StatsPanel({
  status,
  driverCount,
  stats,
  cellCount,
  showHexGrid,
  onToggleHexGrid,
}) {
  const statusLabel =
    {
      connected: "Connected",
      connecting: "Connecting...",
      disconnected: "Disconnected",
    }[status] || "Unknown";

  return (
    <div className="stats-panel">
      <h3>SlipStream Live</h3>

      <div className="stat-row">
        <span>
          <span className={`status-dot ${status}`} />
          {statusLabel}
        </span>
      </div>

      <div className="stat-row">
        <span>Drivers</span>
        <span className="stat-value">{driverCount}</span>
      </div>

      <div className="stat-row">
        <span>Cells</span>
        <span className="stat-value">{cellCount}</span>
      </div>

      <div className="stat-row">
        <span>Messages</span>
        <span className="stat-value">
          {stats.messagesReceived.toLocaleString()}
        </span>
      </div>

      <div className="stat-divider" />

      <button
        className={`toggle-btn ${showHexGrid ? "active" : ""}`}
        onClick={onToggleHexGrid}
        title="Toggle H3 hex grid overlay (also: press H)"
      >
        <span className="toggle-icon">⬡</span>
        {showHexGrid ? "Hide" : "Show"} hex grid
      </button>
    </div>
  );
}
