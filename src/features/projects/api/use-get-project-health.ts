import { InferResponseType } from "hono";
import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

interface UseGetProjectHealthProps {
  projectId: string;
  workspaceId: string;
}

export type ProjectHealthResponseType = InferResponseType<
  typeof client.api.projects[":projectId"]["health"]["$get"],
  200
>;

export const useGetProjectHealth = ({
  projectId,
  workspaceId,
}: UseGetProjectHealthProps) => {
  const query = useQuery({
    queryKey: ["project-health", projectId, workspaceId],
    queryFn: async () => {
      const response = await client.api.projects[":projectId"].health.$get({
        param: {
          projectId,
        },
        query: {
          workspaceId,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch project health");
      }

      const { data } = await response.json();

      return data;
    },
    // Refetch on window focus since health is time-sensitive
    refetchOnWindowFocus: true,
    // Stale after 2 minutes
    staleTime: 2 * 60 * 1000,
  });

  return query;
};
