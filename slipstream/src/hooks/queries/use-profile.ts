import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile } from "@/lib/api/sdk.gen";
import type { UpdateProfileRequest } from "@/lib/api/types.gen";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await getMyProfile();
      if (error || !data) throw new Error("Failed to fetch profile");
      return data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateProfileRequest) => {
      const { data, error } = await updateMyProfile({ body });
      if (error || !data) throw new Error("Failed to update profile");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data);
    },
  });
}
