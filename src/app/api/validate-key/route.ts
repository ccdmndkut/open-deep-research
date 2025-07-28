import { getAIClient } from "@/deepresearch/aiProvider";
import { generateText } from "ai";

export async function POST(request: Request) {
  const { apiKey } = await request.json();

  if (!apiKey) {
    return new Response(JSON.stringify({ message: "API key is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Make a simple LLM call to validate the API key
    await generateText({
      model: getAIClient("Qwen/Qwen2.5-72B-Instruct-Turbo", apiKey),
      maxTokens: 100,
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    });

    return new Response(JSON.stringify({ message: "API key is valid" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("API key validation failed:", error);
    return new Response(
      JSON.stringify({ message: "API key is invalid", error: error.message }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
