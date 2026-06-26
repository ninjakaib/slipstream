import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "@/lib/api/sdk.gen";

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["user-search", query],
    queryFn: async () => {
      const { data, error } = await searchUsers({ query: { q: query } });
      if (error || !data) throw new Error("Search failed");
      return data;
    },
    enabled: query.length >= 2,
  });
}
