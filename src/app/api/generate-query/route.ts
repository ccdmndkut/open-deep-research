import { generateText } from "ai";
import { getAIClient } from "@/deepresearch/aiProvider";
import { MODEL_CONFIG } from "@/deepresearch/config";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { content, url, apiKey } = await req.json();
    
    if (!content || !url) {
      return NextResponse.json(
        { error: "Content and URL are required" },
        { status: 400 }
      );
    }

    const result = await generateText({
      model: getAIClient(MODEL_CONFIG.planningModel, apiKey),
      system: "You are a research assistant. Generate a concise, focused research question based on the webpage content provided. The question should be clear, specific, and suitable for in-depth research.",
      prompt: `Based on the following webpage content, generate a clear and focused research question that would benefit from comprehensive research and analysis.

URL: ${url}

Content (truncated):
${content.substring(0, 5000)}

Generate a single, well-formed research question:`,
      maxTokens: 150,
      temperature: 0.7,
    });
    
    return NextResponse.json({ query: result.text.trim() });
  } catch (error) {
    console.error("Error generating query:", error);
    return NextResponse.json(
      { error: "Failed to generate query from content" },
      { status: 500 }
    );
  }
}