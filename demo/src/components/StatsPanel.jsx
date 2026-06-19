/**
 * StatsPanel — overlay showing connection status and driver count.
 */

/**
 * @param {{ status: string, driverCount: number, stats: object }} props
 */
export function StatsPanel({ status, driverCount, stats }) {
  const statusLabel = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
  }[status] || 'Unknown';

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
        <span>Messages</span>
        <span className="stat-value">{stats.messagesReceived.toLocaleString()}</span>
      </div>
    </div>
  );
}
