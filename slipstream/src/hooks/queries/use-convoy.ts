import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConvoy,
  createConvoy,
  leaveConvoy,
  endConvoy,
  inviteToConvoy,
  kickMember,
  setRoute,
  getActiveRoute,
  getMessages,
  sendMessage,
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
      queryClient.setQueryData(["convoy", data.id], data);
      await setConvoyId(data.id);
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

  const kick = useMutation({
    mutationFn: async (userId: string) => {
      if (!convoyId) throw new Error("No active convoy");
      const { error } = await kickMember({
        path: { convoy_id: convoyId },
        body: { user_id: userId },
      });
      if (error) throw new Error("Failed to kick member");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convoy", convoyId] });
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
    kick,
    setGroupRoute,
    refetch: convoyQuery.refetch,
  };
}

export function useConvoyMessages(convoyId: string | null) {
  return useQuery({
    queryKey: ["convoy-messages", convoyId],
    queryFn: async () => {
      const { data, error } = await getMessages({
        path: { convoy_id: convoyId! },
        query: { limit: 50 },
      });
      if (error || !data) throw new Error("Failed to fetch messages");
      return data;
    },
    enabled: !!convoyId,
    refetchInterval: 5000,
  });
}

export function useSendConvoyMessage(convoyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!convoyId) throw new Error("No active convoy");
      const { data, error } = await sendMessage({
        path: { convoy_id: convoyId },
        body: { content },
      });
      if (error || !data) throw new Error("Failed to send message");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convoy-messages", convoyId] });
    },
  });
}

export function useConvoyRoute(convoyId: string | null) {
  return useQuery({
    queryKey: ["convoy-route", convoyId],
    queryFn: async () => {
      const { data, error } = await getActiveRoute({
        path: { convoy_id: convoyId! },
      });
      if (error || !data) return null;
      return data;
    },
    enabled: !!convoyId,
  });
}
