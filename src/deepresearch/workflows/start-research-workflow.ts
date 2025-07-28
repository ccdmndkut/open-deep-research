/**
 * Start Research Workflow - Orchestrates the complete research process
 * Self-sufficient workflow with all necessary LLM and search logic
 */

import { createWorkflow } from "@upstash/workflow/nextjs";
import { stateStorage, streamStorage } from "../storage";
import { gatherSearchQueriesWorkflow } from "./gather-search-workflow";
import { WorkflowContext } from "@upstash/workflow";
import { generateText, generateObject, streamText } from "ai";
import { MODEL_CONFIG, PROMPTS, RESEARCH_CONFIG } from "../config";
import {
  togetheraiWithKey,
} from "../apiClients";
import { getAIClient } from "../aiProvider";
import {
  researchPlanSchema,
  ResearchState,
  PlanningStartedEvent,
  PlanningCompletedEvent,
  ReportGeneratedEvent,
  ReportGeneratingEvent,
  ResearchCompletedEvent,
  ErrorEvent,
  ReportStartedEvent,
  SearchResult,
} from "../schemas";
import { db } from "@/db";
import { research } from "@/db/schema";
import { eq } from "drizzle-orm";
import { awsS3Client } from "@/lib/clients";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getResearch } from "@/db/action";
import { extractMarkdownHeadings } from "@/lib/utils";
import { togetherRateLimiter } from "../rateLimiter";

const MAX_BUDGET = 3;

// Types
export type StartResearchPayload = {
  topic: string;
  sessionId: string;
  togetherApiKey?: string;
  researchConfig?: {
    maxTokens: number;
    budget: number;
    maxQueries: number;
    maxSources: number;
  };
};

// Helper function to generate research queries
const generateResearchQueries = async (
  topic: string,
  togetherApiKey?: string,
  maxQueries: number = RESEARCH_CONFIG.maxQueries
): Promise<{
  queries: string[];
  plan: string;
  summarisedPlan: string;
}> => {
  // Rate limit Together.ai calls
  await togetherRateLimiter.waitIfNeeded();
  
  const initialSearchEvaluation = await generateText({
    model: getAIClient(MODEL_CONFIG.planningModel, togetherApiKey),
    messages: [
      { role: "system", content: PROMPTS.planningPrompt },
      { role: "user", content: `Research Topic: ${topic}` },
    ],
  });

  console.log(
    `🤖 Initial search evaluation: ${initialSearchEvaluation.text.slice(
      0,
      100
    )}...`
  );

  // Run plan parsing and summary generation in parallel
  // Rate limit before parallel calls
  await togetherRateLimiter.waitIfNeeded();
  
  const [parsedPlan, planSummary] = await Promise.all([
    generateObject({
      model: getAIClient(MODEL_CONFIG.jsonModel, togetherApiKey),
      messages: [
        { role: "system", content: PROMPTS.planParsingPrompt },
        { role: "user", content: initialSearchEvaluation.text },
      ],
      schema: researchPlanSchema,
    }),
    generateText({
      model: getAIClient(MODEL_CONFIG.summaryModel, togetherApiKey),
      messages: [
        { role: "system", content: PROMPTS.planSummaryPrompt },
        { role: "user", content: initialSearchEvaluation.text },
      ],
    }),
  ]);

  console.log(`🤖 Parsed plan: ${JSON.stringify(parsedPlan.object, null, 2)}`);
  console.log(`🤖 Plan summary: ${planSummary.text.slice(0, 100)}...`);

  console.log(
    `📋 Research queries generated: \n - ${parsedPlan.object.queries.join(
      "\n - "
    )}`
  );

  const dedupedQueries = Array.from(new Set(parsedPlan.object.queries));
  const queries = dedupedQueries.slice(0, maxQueries);

  return {
    queries,
    plan: initialSearchEvaluation.text,
    summarisedPlan: planSummary.text,
  };
};

// Helper function to generate final research answer with progressive updates
const generateResearchAnswer = async ({
  topic,
  results,
  sessionId,
  togetherApiKey,
  maxTokens = RESEARCH_CONFIG.maxTokens,
}: {
  topic: string;
  results: SearchResult[];
  sessionId: string;
  togetherApiKey?: string;
  maxTokens?: number;
}): Promise<string> => {
  const formattedSearchResults = results
    .map(
      (result) =>
        `- Link: ${result.link}\nTitle: ${result.title}\nSummary: ${result.summary}\n\n`
    )
    .join("\n");

  let fullReport = "";

  // Rate limit Together.ai calls
  await togetherRateLimiter.waitIfNeeded();
  
  const { textStream } = await streamText({
    model: getAIClient(MODEL_CONFIG.answerModel, togetherApiKey),
    messages: [
      { role: "system", content: PROMPTS.answerPrompt },
      {
        role: "user",
        content: `Research Topic: ${topic}\n\nSearch Results:\n${formattedSearchResults}`,
      },
    ],
    maxTokens: maxTokens,
  });

  let index = 0;
  for await (const textPart of textStream) {
    fullReport += textPart;
    // Emit progressive report updates
    index++;
    if (index % 250 === 0) {
      await streamStorage.addEvent(sessionId, {
        type: "report_generating",
        partialReport: fullReport,
        timestamp: Date.now(),
      } satisfies ReportGeneratingEvent);
    }
  }

  console.log(`🤖 Full report: ${fullReport.slice(0, 100)}...`);
  return fullReport.trim();
};

// Main workflow that orchestrates the entire research process
export const startResearchWorkflow = createWorkflow<
  StartResearchPayload,
  string
>(async (context: WorkflowContext<StartResearchPayload>) => {
  const { topic, sessionId, togetherApiKey, researchConfig } = context.requestPayload;
  
  // Use custom config or defaults
  const config = {
    maxTokens: researchConfig?.maxTokens || RESEARCH_CONFIG.maxTokens,
    budget: researchConfig?.budget || RESEARCH_CONFIG.budget,
    maxQueries: researchConfig?.maxQueries || RESEARCH_CONFIG.maxQueries,
    maxSources: researchConfig?.maxSources || RESEARCH_CONFIG.maxSources,
  };

  // Step 1: Generate initial research plan using LLM
  const initialQueries = await context.run(
    "generate-initial-plan",
    async () => {
      console.log(
        `🔍 Starting research for: ${topic} and Session ID: ${sessionId}`
      );

      const researchData = await getResearch(sessionId);

      if (!researchData || !researchData.clerkUserId) {
        await streamStorage.addEvent(sessionId, {
          type: "error",
          message: "Research with clerk user not found",
          step: "generate-initial-plan",
          timestamp: Date.now(),
        } satisfies ErrorEvent);
        throw new Error("Research with clerk user not found");
      }

      // Emit planning started event
      await streamStorage.addEvent(sessionId, {
        type: "planning_started",
        topic: researchData?.initialUserMessage || topic,
        timestamp: Date.now(),
      } satisfies PlanningStartedEvent);

      try {
        // Generate queries using local LLM function
        const { queries, plan, summarisedPlan } = await generateResearchQueries(
          topic,
          togetherApiKey,
          config.maxQueries
        );

        // Emit queries generated event
        await streamStorage.addEvent(sessionId, {
          type: "planning_completed",
          queries,
          plan: summarisedPlan,
          iteration: 0,
          timestamp: Date.now(),
        } satisfies PlanningCompletedEvent);

        // Initialize state in Redis
        const initialState: ResearchState = {
          topic,
          allQueries: queries,
          searchResults: [],
          budget: config.budget, // Allowed iterations
          iteration: 0,
        };
        await stateStorage.store(sessionId, initialState);

        console.log(`📋 Generated ${queries.length} initial queries`);
        return queries;
      } catch (error) {
        // Emit error event
        await streamStorage.addEvent(sessionId, {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unknown error during planning",
          step: "generate-initial-plan",
          iteration: 0,
          timestamp: Date.now(),
        } satisfies ErrorEvent);
        throw error;
      }
    }
  );

  // Step 2: Invoke the iterative search workflow
  const gatherResponse = await context.invoke("invoke-gather-search", {
    workflow: gatherSearchQueriesWorkflow,
    body: {
      topic,
      queries: initialQueries,
      existingResults: [],
      budget: config.budget,
      iteration: 1,
      sessionId,
    },
  });

  if (gatherResponse.isCanceled || gatherResponse.isFailed) {
    console.error("Gather search workflow failed or was canceled");
    return "Research failed during data gathering phase";
  }

  // Step 3: Generate a cover image for the research topic
  const coverImagePromise = context.run("generate-toc-image", async () => {
    console.log(`🎨 Generating cover image...`);

    try {
      // Generate the image prompt using the planning model
      await togetherRateLimiter.waitIfNeeded();
      
      const imageGenerationPrompt = await generateText({
        model: getAIClient(MODEL_CONFIG.summaryModel),
        messages: [
          { role: "system", content: PROMPTS.dataVisualizerPrompt },
          { role: "user", content: `Research Topic: ${topic}` },
        ],
      });

      if (!imageGenerationPrompt.text) {
        return undefined;
      }

      console.log(`📸 Image generation prompt: ${imageGenerationPrompt.text}`);

      await streamStorage.addEvent(sessionId, {
        type: "cover_generation_started",
        prompt: imageGenerationPrompt.text,
        timestamp: Date.now(),
      });

      // Rate limit before image generation
      await togetherRateLimiter.waitIfNeeded();
      
      const generatedImage = await togetheraiWithKey(
        togetherApiKey || ""
      ).images.create({
        prompt: imageGenerationPrompt.text,
        model: "black-forest-labs/FLUX.1-dev",
        width: 1024,
        height: 768,
        steps: 30,
      });

      const fluxImageUrl = generatedImage.data[0].url;

      if (!fluxImageUrl) return undefined;

      const fluxFetch = await fetch(fluxImageUrl);
      const fluxImage = await fluxFetch.blob();
      const imageBuffer = Buffer.from(await fluxImage.arrayBuffer());

      const coverImageKey = `research-cover-${generatedImage.id}.jpg`;

      // Local storage instead of S3
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const localPath = path.join(process.cwd(), 'public', 'research-covers', coverImageKey);
      await fs.writeFile(localPath, imageBuffer);
      
      const imageUrl = `/research-covers/${coverImageKey}`;

      await streamStorage.addEvent(sessionId, {
        type: "cover_generation_completed",
        coverImage: imageUrl,
        timestamp: Date.now(),
      });

      return imageUrl;
    } catch (error) {
      console.error(`Failed to generate TOC image: ${error}`);
      throw error;
    }
  });

  // Step 4: Generate final comprehensive report using LLM
  const finalReportPromise = context.run("generate-final-report", async () => {
    console.log(`✨ Generating final report for ${sessionId}`);

    try {
      // Read final state from Redis
      const finalState = await stateStorage.get(sessionId);
      if (!finalState) {
        throw new Error("Could not read final research state");
      }

      await streamStorage.addEvent(sessionId, {
        type: "report_started",
        timestamp: Date.now(),
      } satisfies ReportStartedEvent);

      console.log(
        `📝 Generating report for ${finalState.searchResults.length} results`
      );

      const report = await generateResearchAnswer({
        topic,
        results: finalState.searchResults,
        sessionId,
        togetherApiKey,
        maxTokens: config.maxTokens,
      });

      // Emit report generated event
      await streamStorage.addEvent(sessionId, {
        type: "report_generated",
        report: report,
        timestamp: Date.now(),
      } satisfies ReportGeneratedEvent);

      return report;
    } catch (error) {
      // Emit error event
      await streamStorage.addEvent(sessionId, {
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error during report generation",
        step: "generate-final-report",
        timestamp: Date.now(),
      } satisfies ErrorEvent);
      throw error;
    }
  });

  const [coverImage, finalReport] = await Promise.all([
    coverImagePromise,
    finalReportPromise,
  ]);

  // Step 5: Store the final report with cover image in the database and mark as completed the research
  await context.run("complete-research", async () => {
    try {
      // Read final state from Redis
      const finalState = await stateStorage.get(sessionId);
      if (!finalState) {
        throw new Error("Could not read final research state");
      }

      const headings = extractMarkdownHeadings(finalReport);

      const headingOne =
        headings && headings.find((heading) => heading.level === 1);

      await db
        .update(research)
        .set({
          report: finalReport,
          coverUrl: coverImage,
          status: "completed",
          title: headingOne?.text,
          completedAt: new Date(),
          sources: finalState.searchResults.map((result) => ({
            url: result.link,
            title: result.title,
          })),
        })
        .where(eq(research.id, sessionId))
        .returning();

      // Emit research completed event
      await streamStorage.addEvent(sessionId, {
        type: "research_completed",
        finalResultCount: finalState.searchResults.length,
        totalIterations: finalState.iteration,
        timestamp: Date.now(),
      } satisfies ResearchCompletedEvent);

      console.log(
        `🎉 Research completed: ${finalState.allQueries.length} queries, ${finalState.searchResults.length} results, ${finalState.iteration} iterations`
      );
    } catch (error) {
      // Emit error event
      await streamStorage.addEvent(sessionId, {
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error during report generation",
        step: "complete-research",
        timestamp: Date.now(),
      } satisfies ErrorEvent);
      throw error;
    }
  });

  return finalReport;
});
