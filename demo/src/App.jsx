import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { MapView } from "./components/MapView";
import { LoginForm } from "./components/LoginForm";
import { StatsPanel } from "./components/StatsPanel";
import "./App.css";

function App() {
  const [token, setToken] = useState(null);
  const [showHexGrid, setShowHexGrid] = useState(false);
  const [viewportCells, setViewportCells] = useState([]);
  const { drivers, status, sendViewportUpdate, stats } = useWebSocket(token);
  const driverCount = Object.keys(drivers).length;

  // When viewport cells change, track them locally AND send to server
  const handleCellsChanged = useCallback(
    (cells) => {
      setViewportCells(cells);
      sendViewportUpdate(cells);
    },
    [sendViewportUpdate],
  );

  // Keyboard shortcut: press H to toggle hex grid
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.key === "h" || e.key === "H") {
        setShowHexGrid((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <MapView
        drivers={drivers}
        onCellsChanged={handleCellsChanged}
        showHexGrid={showHexGrid}
        viewportCells={viewportCells}
      />

      {status !== "disconnected" && (
        <StatsPanel
          status={status}
          driverCount={driverCount}
          stats={stats}
          cellCount={viewportCells.length}
          showHexGrid={showHexGrid}
          onToggleHexGrid={() => setShowHexGrid((v) => !v)}
        />
      )}

      {!token && <LoginForm onLogin={setToken} />}
    </>
  );
}

export default App;
