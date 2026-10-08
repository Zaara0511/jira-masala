import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.comments[":commentId"]["$patch"], 200>;
type RequestType = InferRequestType<typeof client.api.comments[":commentId"]["$patch"]>;

export const useUpdateComment = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.comments[":commentId"]["$patch"]({ param, json });

      if (!response.ok) {
        throw new Error("Failed to update comment");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
  });

  return mutation;
};
