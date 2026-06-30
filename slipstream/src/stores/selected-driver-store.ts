import { create } from "zustand";

interface SelectedDriverState {
  /** The user ID of the currently selected driver (tapped on map) */
  selectedDriverId: string | null;

  /** Select a driver (e.g., from tapping on map or friends list) */
  selectDriver: (userId: string) => void;

  /** Clear the selection */
  clearSelection: () => void;
}

export const useSelectedDriverStore = create<SelectedDriverState>((set) => ({
  selectedDriverId: null,

  selectDriver: (userId) => {
    console.log("[SelectedDriverStore] selectDriver:", userId);
    set({ selectedDriverId: userId });
  },

  clearSelection: () => {
    console.log("[SelectedDriverStore] clearSelection");
    set({ selectedDriverId: null });
  },
}));
