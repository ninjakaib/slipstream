import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConvoy,
  createConvoy,
  leaveConvoy,
  endConvoy,
  inviteToConvoy,
  setRoute,
} from "@/lib/api/sdk.gen";
import type { CreateConvoyRequest, SetRouteRequest } from "@/lib/api/types.gen";
import { useConvoyId } from "@/hooks/use-convoy-id";
import { useAuth } from "@/contexts/auth-context";

export function useConvoyState() {
  const { convoyId, setConvoyId, loaded } = useConvoyId();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const convoyQuery = useQuery({
    queryKey: ["convoy", convoyId],
    queryFn: async () => {
      const { data, error } = await getConvoy({
        path: { convoy_id: convoyId! },
      });
      if (error || !data) {
        await setConvoyId(null);
        return null;
      }
      if (data.status === "ended") {
        await setConvoyId(null);
        return null;
      }
      return data;
    },
    enabled: loaded && !!convoyId,
  });

  const isLeader = convoyQuery.data?.leader_id === session?.userId;

  const create = useMutation({
    mutationFn: async (body?: CreateConvoyRequest) => {
      const { data, error } = await createConvoy({
        body: body ?? { name: "Open Cruise" },
      });
      if (error || !data) throw new Error("Failed to create convoy");
      return data;
    },
    onSuccess: async (data) => {
      await setConvoyId(data.id);
      queryClient.setQueryData(["convoy", data.id], data);
    },
  });

  const leave = useMutation({
    mutationFn: async () => {
      if (!convoyId) throw new Error("No active convoy");
      const { error } = await leaveConvoy({ path: { convoy_id: convoyId } });
      if (error) throw new Error("Failed to leave convoy");
    },
    onSuccess: async () => {
      await setConvoyId(null);
      queryClient.removeQueries({ queryKey: ["convoy", convoyId] });
    },
  });

  const end = useMutation({
    mutationFn: async () => {
      if (!convoyId) throw new Error("No active convoy");
      const { error } = await endConvoy({ path: { convoy_id: convoyId } });
      if (error) throw new Error("Failed to end convoy");
    },
    onSuccess: async () => {
      await setConvoyId(null);
      queryClient.removeQueries({ queryKey: ["convoy", convoyId] });
    },
  });

  const invite = useMutation({
    mutationFn: async (userId: string) => {
      if (!convoyId) throw new Error("No active convoy");
      const { error } = await inviteToConvoy({
        path: { convoy_id: convoyId },
        body: { user_id: userId },
      });
      if (error) throw new Error("Failed to invite user");
    },
  });

  const setGroupRoute = useMutation({
    mutationFn: async (body: SetRouteRequest) => {
      if (!convoyId) throw new Error("No active convoy");
      const { data, error } = await setRoute({
        path: { convoy_id: convoyId },
        body,
      });
      if (error || !data) throw new Error("Failed to set route");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convoy", convoyId] });
    },
  });

  return {
    convoy: convoyQuery.data ?? null,
    isLoading: !loaded || convoyQuery.isLoading,
    isLeader,
    convoyId,
    setConvoyId,
    create,
    leave,
    end,
    invite,
    setGroupRoute,
    refetch: convoyQuery.refetch,
  };
}
