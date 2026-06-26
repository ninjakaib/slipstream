import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

const CONVOY_ID_KEY = "active_convoy_id";

export function useConvoyId() {
  const [convoyId, setConvoyIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(CONVOY_ID_KEY).then((id) => {
      if (id) setConvoyIdState(id);
      setLoaded(true);
    });
  }, []);

  const setConvoyId = useCallback(async (id: string | null) => {
    setConvoyIdState(id);
    if (id) {
      await SecureStore.setItemAsync(CONVOY_ID_KEY, id);
    } else {
      await SecureStore.deleteItemAsync(CONVOY_ID_KEY);
    }
  }, []);

  return { convoyId, setConvoyId, loaded };
}
