import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listFriends,
  listFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/lib/api/sdk.gen";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const { data, error } = await listFriends();
      if (error || !data) throw new Error("Failed to fetch friends");
      return data;
    },
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ["friend-requests"],
    queryFn: async () => {
      const { data, error } = await listFriendRequests();
      if (error || !data) throw new Error("Failed to fetch friend requests");
      return data;
    },
  });
}

export function useAcceptFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await acceptFriendRequest({
        body: { request_id: requestId },
      });
      if (error || !data) throw new Error("Failed to accept friend request");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });
}

export function useDeclineFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await declineFriendRequest({
        body: { request_id: requestId },
      });
      if (error || !data) throw new Error("Failed to decline friend request");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await removeFriend({ path: { user_id: userId } });
      if (error || !data) throw new Error("Failed to remove friend");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

export function useSendFriendRequest() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await sendFriendRequest({
        body: { user_id: userId },
      });
      if (error || !data) throw new Error("Failed to send friend request");
      return data;
    },
  });
}
