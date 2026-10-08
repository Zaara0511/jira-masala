import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export const getAIProvider = () => {
  const provider = process.env.AI_PROVIDER || "openai";

  if (provider === "gemini") {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      fetch: async (url, options) => {
        const response = await fetch(url, options);
        if (response.status === 429) {
          // Read the body to get the detailed Gemini error (including retryDelay)
          let errorText = "";
          try {
            errorText = await response.text();
          } catch {
            // Ignore
          }
          // Throwing a standard Error prevents the AI SDK from aggressively retrying 429s
          throw new Error(`429 RESOURCE_EXHAUSTED: ${errorText}`);
        }
        return response;
      }
    });
    return google("gemini-3.5-flash");
  } else {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return openai("gpt-4o");
  }
};
