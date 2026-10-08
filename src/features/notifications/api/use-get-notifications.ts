import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetNotificationsProps {
  workspaceId: string;
}

export const useGetNotifications = ({ workspaceId }: UseGetNotificationsProps) => {
  const query = useQuery({
    queryKey: ["notifications", workspaceId],
    queryFn: async () => {
      const response = await client.api.notifications.$get({ query: { workspaceId } });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const { data } = await response.json();
      return data;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  return query;
};
