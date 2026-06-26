import { create } from "zustand";
import type { DriverData } from "@/hooks/use-websocket";

interface DriversState {
  drivers: Record<string, DriverData>;
  driverIds: Set<string>;
  setDriver: (id: string, data: DriverData) => void;
  removeDriver: (id: string) => void;
  setSnapshot: (snapshot: DriverData[]) => void;
  clear: () => void;
}

export const useDriversStore = create<DriversState>((set) => ({
  drivers: {},
  driverIds: new Set(),

  setDriver: (id, data) =>
    set((state) => {
      const drivers = { ...state.drivers, [id]: data };
      const hadId = state.driverIds.has(id);
      const driverIds = hadId ? state.driverIds : new Set([...state.driverIds, id]);
      return { drivers, driverIds };
    }),

  removeDriver: (id) =>
    set((state) => {
      const { [id]: _, ...drivers } = state.drivers;
      const driverIds = new Set(state.driverIds);
      driverIds.delete(id);
      return { drivers, driverIds };
    }),

  setSnapshot: (snapshot) =>
    set((state) => {
      const drivers = { ...state.drivers };
      let idsChanged = false;
      const newIds = new Set(state.driverIds);
      for (const driver of snapshot) {
        drivers[driver.user_id] = driver;
        if (!newIds.has(driver.user_id)) {
          newIds.add(driver.user_id);
          idsChanged = true;
        }
      }
      return { drivers, driverIds: idsChanged ? newIds : state.driverIds };
    }),

  clear: () => set({ drivers: {}, driverIds: new Set() }),
}));
