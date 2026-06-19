import { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { MapView } from "./components/MapView";
import { LoginForm } from "./components/LoginForm";
import { StatsPanel } from "./components/StatsPanel";
import "./App.css";

function App() {
  const [token, setToken] = useState(null);
  const { drivers, status, sendViewportUpdate, stats } = useWebSocket(token);
  const driverCount = Object.keys(drivers).length;

  return (
    <>
      <MapView drivers={drivers} sendViewportUpdate={sendViewportUpdate} />

      {status !== "disconnected" && (
        <StatsPanel status={status} driverCount={driverCount} stats={stats} />
      )}

      {!token && <LoginForm onLogin={setToken} />}
    </>
  );
}

export default App;
