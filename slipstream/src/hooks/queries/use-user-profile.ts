import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/api/sdk.gen";

export function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await getUserProfile({
        path: { user_id: userId! },
      });
      if (error || !data) throw new Error("Failed to fetch user profile");
      return data;
    },
    enabled: !!userId,
  });
}
