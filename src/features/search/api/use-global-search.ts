import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGlobalSearchProps {
  workspaceId: string;
  query: string;
}

export const useGlobalSearch = ({ workspaceId, query }: UseGlobalSearchProps) => {
  return useQuery({
    queryKey: ["search", workspaceId, query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      const response = await client.api.search.$get({ query: { workspaceId, query } });

      if (!response.ok) {
        throw new Error("Failed to perform search");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId && query.length >= 2,
  });
};
