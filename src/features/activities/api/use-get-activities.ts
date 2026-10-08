import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetActivitiesProps {
  workspaceId: string;
  projectId?: string | null;
  userId?: string | null;
  eventCategory?: string | null;
  action?: string | null;
  limit?: number;
  offset?: number;
}

export const useGetActivities = ({
  workspaceId,
  projectId,
  userId,
  eventCategory,
  action,
  limit = 20,
  offset = 0
}: UseGetActivitiesProps) => {
  const query = useQuery({
    queryKey: [
      "activities",
      workspaceId,
      projectId,
      userId,
      eventCategory,
      action,
      limit,
      offset
    ],
    queryFn: async () => {
      const response = await client.api.activities.$get({
        query: {
          workspaceId,
          projectId: projectId ?? undefined,
          userId: userId ?? undefined,
          eventCategory: eventCategory ?? undefined,
          action: action ?? undefined,
          limit: limit.toString(),
          offset: offset.toString(),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
