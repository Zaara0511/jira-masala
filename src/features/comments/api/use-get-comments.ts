import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetCommentsProps {
  taskId: string;
}

export const useGetComments = ({ taskId }: UseGetCommentsProps) => {
  const query = useQuery({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      const response = await client.api.comments.$get({ query: { taskId } });

      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
