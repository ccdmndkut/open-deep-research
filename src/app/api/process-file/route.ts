import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { togetheraiClient, togetheraiClientWithKey } from "@/deepresearch/apiClients";
import { MODEL_CONFIG } from "@/deepresearch/config";
import dedent from "dedent";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.pdf')) {
    // For now, we'll skip PDF processing due to library issues
    // You can implement PDF parsing later with a different library
    throw new Error("PDF files are not currently supported. Please upload .txt or .md files.");
  } else {
    // For text files, markdown, etc.
    return await file.text();
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const apiKey = formData.get("apiKey") as string | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Extract text content based on file type
    let fileContent: string;
    try {
      fileContent = await extractTextFromFile(file);
    } catch (error) {
      console.error("Error extracting text from file:", error);
      return NextResponse.json({ error: "Failed to read file content" }, { status: 400 });
    }
    
    const fileName = file.name;
    const fileType = file.type;

    // Prepare prompt for AI processing
    const prompt = dedent`
      You are an AI assistant helping to create a research question based on the uploaded file.
      
      File Name: ${fileName}
      File Type: ${fileType}
      
      Content:
      ${fileContent.substring(0, 8000)} ${fileContent.length > 8000 ? '...[truncated]' : ''}
      
      Based on this file, generate a clear, specific research question or topic that would benefit from deep research and analysis.
      The research question should:
      1. Be directly related to the content of the file
      2. Be specific and well-defined
      3. Be suitable for comprehensive research with multiple sources
      4. Focus on aspects that require investigation beyond what's in the file
      
      Respond with only the research question/topic, nothing else.
    `;

    // Use custom API key if provided, otherwise use default
    const client = apiKey ? togetheraiClientWithKey(apiKey) : togetheraiClient;

    const result = await generateText({
      model: client(MODEL_CONFIG.planningModel),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      maxTokens: 200,
    });

    return NextResponse.json({ 
      researchTopic: result.text.trim(),
      fileName: fileName,
    });
  } catch (error) {
    console.error("Error processing file:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}