/**
 * StatsPanel — overlay showing connection status, driver count, and debug controls.
 */
import { CONTAINMENT_MODES, SERVER_RESOLUTIONS } from "../lib/spatial";

export function StatsPanel({
  status,
  driverCount,
  stats,
  cellCount,
  currentResolution,
  showHexGrid,
  onToggleHexGrid,
  containmentMode,
  onContainmentModeChange,
  serverOnly,
  onServerOnlyChange,
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
        <span>Resolution</span>
        <span className="stat-value">{currentResolution}</span>
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
        title="Toggle H3 hex grid overlay (press H)"
      >
        <span className="toggle-icon">⬡</span>
        {showHexGrid ? "Hide" : "Show"} hex grid
      </button>

      {showHexGrid && (
        <div className="hex-controls">
          <label className="control-label">Containment</label>
          <div className="control-row">
            {Object.entries(CONTAINMENT_MODES).map(([key, { label }]) => (
              <button
                key={key}
                className={`mode-btn ${containmentMode === key ? "active" : ""}`}
                onClick={() => onContainmentModeChange(key)}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="control-label">Resolutions</label>
          <div className="control-row">
            <button
              className={`mode-btn ${serverOnly ? "active" : ""}`}
              onClick={() => onServerOnlyChange(true)}
            >
              Server ({SERVER_RESOLUTIONS.join(",")})
            </button>
            <button
              className={`mode-btn ${!serverOnly ? "active" : ""}`}
              onClick={() => onServerOnlyChange(false)}
            >
              All (0–15)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
