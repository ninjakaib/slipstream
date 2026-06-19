import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { MapView } from "./components/MapView";
import { LoginForm } from "./components/LoginForm";
import { StatsPanel } from "./components/StatsPanel";
import "./App.css";

function App() {
  const [token, setToken] = useState(null);
  const [showHexGrid, setShowHexGrid] = useState(false);
  const [viewportCells, setViewportCells] = useState([]);
  const [currentResolution, setCurrentResolution] = useState(0);
  const [containmentMode, setContainmentMode] = useState("overlapping");
  const [serverOnly, setServerOnly] = useState(true);
  const { drivers, status, sendViewportUpdate, stats } = useWebSocket(token);
  const driverCount = Object.keys(drivers).length;

  // Memoize cell options to prevent unnecessary re-renders
  const cellOptions = useMemo(
    () => ({ containmentMode, serverOnly }),
    [containmentMode, serverOnly],
  );

  // When viewport cells change, track them locally AND send to server
  const handleCellsChanged = useCallback(
    (cells, resolution) => {
      setViewportCells(cells);
      setCurrentResolution(resolution);
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
        cellOptions={cellOptions}
      />

      {status !== "disconnected" && (
        <StatsPanel
          status={status}
          driverCount={driverCount}
          stats={stats}
          cellCount={viewportCells.length}
          currentResolution={currentResolution}
          showHexGrid={showHexGrid}
          onToggleHexGrid={() => setShowHexGrid((v) => !v)}
          containmentMode={containmentMode}
          onContainmentModeChange={setContainmentMode}
          serverOnly={serverOnly}
          onServerOnlyChange={setServerOnly}
        />
      )}

      {!token && <LoginForm onLogin={setToken} />}
    </>
  );
}

export default App;
