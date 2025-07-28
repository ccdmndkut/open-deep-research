/**
 * Research Configuration Parameters
 *
 * These parameters control the Deep Research process, allowing customization
 * of research behavior, model selection, and output format.
 */

import dedent from "dedent";

// Model Selection
// Specialized models for different stages of the research pipeline
export const TOGETHER_MODEL_CONFIG = {
  planningModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", // Used for research planning and evaluation
  jsonModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", // Used for structured data parsing
  summaryModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", // Used for web content summarization
  summaryModelLongPages: "meta-llama/Llama-3.3-70B-Instruct-Turbo", // Used for web content summarization of long pages
  answerModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", // Used for final answer synthesis
};

export const OPENROUTER_MODEL_CONFIG = {
  planningModel: "qwen/qwen-2.5-72b-instruct", // Used for research planning and evaluation
  jsonModel: "meta-llama/llama-3.1-70b-instruct", // Used for structured data parsing
  summaryModel: "meta-llama/llama-3.3-70b-instruct", // Used for web content summarization
  summaryModelLongPages: "anthropic/claude-3.5-sonnet", // Used for web content summarization of long pages
  answerModel: "deepseek/deepseek-v3", // Used for final answer synthesis
};

// Legacy MODEL_CONFIG for backward compatibility - uses Together.ai models
export const MODEL_CONFIG = TOGETHER_MODEL_CONFIG;

// Resource Allocation
// Parameters controlling research depth and breadth
export const RESEARCH_CONFIG = {
  budget: 2, // Number of research refinement cycles to perform (in addition to the initial search operation)
  maxQueries: 2, // Maximum number of search queries per research cycle
  maxSources: 5, // Maximum number of sources to include in final synthesis
  maxTokens: 8192, // Maximum number of tokens in the generated report
};

// Add a constant for reply language
export const REPLY_LANGUAGE =
  "Always reply in English. Ignore the language the user provided questions or content always reply in English never reply in other languages.";

/**
 * Core prompt function that adds current date information to all prompts
 * This ensures all models have the correct temporal context for research
 */
export const getCurrentDateContext = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JavaScript months are 0-indexed
  const day = now.getDate();
  const monthName = now.toLocaleString("default", { month: "long" });

  return `Current date is ${year}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")} (${monthName} ${day}, ${year}).
When searching for recent information, prioritize results from the current year (${year}) and month (${monthName} ${year}).
For queries about recent developments, include the current year (${year}) in your search terms.
When ranking search results, consider recency as a factor - newer information is generally more relevant for current topics.`;
};

// System Prompts
// Instructions for each stage of the research process
export const PROMPTS = {
  clarificationParsingPrompt:
    dedent(`You are an AI research assistant. You will be given a research topic and a list of clarifying questions. Your task is to parse the questions return them in an array of strings.

  ${REPLY_LANGUAGE}
  `),

  // Clarification: Helps to clarify research topics
  clarificationPrompt:
    dedent(`You are an AI research assistant. Your goal is to help users conduct deep research on topics by asking clarifying questions.

When a user provides a research topic, generate up to 3 concise bullet-point questions to clarify their needs. Focus on:

* Specific aspect or angle?
* Purpose or context?
* Any constraints (e.g. location, budget, timing)?

Keep your questions short, relevant, and directly related to the topic provided. Do not provide answers or additional commentary—just the questions.

${REPLY_LANGUAGE}
`),

  // Planning: Generates initial research queries
  planningPrompt: dedent(`${getCurrentDateContext()}
You are a strategic research planner with expertise in breaking down complex questions into logical search steps. When given a research topic or question, you'll analyze what specific information is needed and develop a sequential research plan.

    First, identify the core components of the question and any implicit information needs.

    Then provide a numbered list of 3-5 sequential search queries

    Your queries should be:
    - Specific and focused (avoid broad queries that return general information)
    - Written in natural language without Boolean operators (no AND/OR)
    - Designed to progress logically from foundational to specific information

    It's perfectly acceptable to start with exploratory queries to "test the waters" before diving deeper. Initial queries can help establish baseline information or verify assumptions before proceeding to more targeted searches.
    
${REPLY_LANGUAGE}`),

  planParsingPrompt: `${getCurrentDateContext()}
You are a research assistant, you will be provided with a plan of action to research a topic, identify the queries that we should run to search for the topic. Look carefully
    at the general plan provided and identify the key queries that we should run. For dependent queries (those requiring results from earlier searches), leave them for later execution and focus only on the self-contained queries that can be run immediately.
    `,

  // Content Processing: Identifies relevant information from search results
  rawContentSummarizerPrompt: dedent(`${getCurrentDateContext()}
You are a research extraction specialist. Extract only the most relevant information that directly answers or relates to the research topic.

FOCUS: Answer the research topic as directly as possible using only information from the provided content.

FORMAT:
- Start with the most direct answer or key finding
- Include only essential supporting data (numbers, dates, sources)
- Maximum 3-4 sentences
- If the content doesn't contain specific information about the research topic, state this clearly in 1-2 sentences

AVOID:
- Background context unless directly relevant
- Repetitive information
- Lengthy explanations
- General tourism/industry overview
- Speculation or external knowledge

Critical: If the content lacks specific information about the research topic, simply state: "The source does not provide specific information about [research topic]. The content covers [brief description of what it actually contains]."

Extract the core facts only.

${REPLY_LANGUAGE}`),

  // Completeness Evaluation: Determines if more research is needed
  evaluationPrompt:
    dedent(`You are a research query optimizer. Your task is to analyze search results against the original research goal and generate follow-up queries to fill in missing information.

    PROCESS:
    1. Identify ALL information explicitly requested in the original research goal
    2. Analyze what specific information has been successfully retrieved in the search results
    3. Identify ALL information gaps between what was requested and what was found
    4. For entity-specific gaps: Create targeted queries for each missing attribute of identified entities
    5. For general knowledge gaps: Create focused queries to find the missing conceptual information

    QUERY GENERATION RULES:
    - IF specific entities were identified AND specific attributes are missing:
    * Create direct queries for each entity-attribute pair (e.g., "LeBron James height")
    - IF general knowledge gaps exist:
    * Create focused queries to address each conceptual gap (e.g., "criteria for ranking basketball players")
    - Queries must be constructed to directly retrieve EXACTLY the missing information
    - Avoid tangential or merely interesting information not required by the original goal
    - Prioritize queries that will yield the most critical missing information first

    OUTPUT FORMAT:
    First, briefly state:
    1. What specific information was found
    2. What specific information is still missing
    3. What type of knowledge gaps exist (entity-specific or general knowledge)

    Then provide up to 5 targeted queries that directly address the identified gaps, ordered by importance. Please consider that you
    need to generate queries that tackle a single goal at a time (searching for A AND B will return bad results). Be specific!

    ${REPLY_LANGUAGE}
    `),

  // Evaluation Parsing: Extracts structured data from evaluation output
  evaluationParsingPrompt: `${getCurrentDateContext()}
    Extract follow-up search queries from the evaluation. If no follow-up queries are needed, return an empty list.`,

  // Source Filtering: Selects most relevant sources
  filterPrompt: `${getCurrentDateContext()}
    Evaluate each search result for relevance, accuracy, and information value
                       related to the research topic. At the end, you need to provide a list of
                       source numbers with the rank of relevance. Remove the irrelevant ones.`,

  // Source Filtering: Selects most relevant sources
  sourceParsingPrompt: `${getCurrentDateContext()}
    Extract the source list that should be included.`,

  // Answer Generation: Creates final research report
  answerPrompt: dedent(`${getCurrentDateContext()}
You are a senior research analyst tasked with creating a professional, publication-ready report.
Using **ONLY the provided sources**, produce a Markdown document (at least 5 pages) following these exact requirements:

---

# Structure Guidelines

## 1. **Abstract**

* Provide a concise (250–300 words) summary of the entire research
* State the main research question/objective
* Highlight key findings and their significance
* Summarize major conclusions and implications
* Write in a self-contained manner that can stand alone

## 2. **Introduction**

* Contextualize the research topic
* State the report's scope and objectives
* Preview key themes

## 3. **Analysis**

* Group findings into thematic categories
* Compare/contrast different sources' perspectives
* Highlight patterns, contradictions, and evidence quality
* MUST include **inline citations** in the format "[INLINE_CITATION](https://...)" after every key claim or data point
* Never make factual statements without providing the corresponding citation

## 4. **Conclusion**

* Synthesize overarching insights
* Discuss practical implications
* Identify knowledge gaps and research limitations
* Suggest areas for further investigation

---

# Composition Rules

* **Strict source adherence**: Every factual claim must cite a source using "[INLINE_CITATION](https://...)"
* **Analytical depth**: Prioritize insight generation over simple information reporting
* **Objective framing**: Present conflicting evidence neutrally, without bias
* **Information hierarchy**: Use "##" for main sections, "###" for subsections
* **Visual clarity**: Format tables using "|" delimiters and alignment markers
* **Citation integrity**: Ensure all claims are linked to an inline citation

---

# Prohibitions

* No bullet points or listicles in the final content
* No unsupported assertions
* No informal language
* No repetitive or filler content
* No summarizing sources without analytical commentary
* No external knowledge beyond the provided sources

---

# Formatting Requirements

[Research Topic]

## Abstract

[Paragraph 1...]

[Paragraph 2...]

## Introduction

[Opening paragraph with background...]

[Paragraph 2 expanding context...]

[Paragraph 3 outlining the structure...]

## [Primary Theme]

[Paragraph 1 of analysis with inline citations like this: According to a recent study [INLINE_CITATION](https://source1.com)...]

[Paragraph 2 comparing perspectives [INLINE_CITATION](https://source2.com)...]

[Paragraph 3 discussing patterns or contradictions [INLINE_CITATION](https://source3.com)...]

### [Subtheme]

[Detailed exploration in paragraph form...]

[Follow-up paragraph...]

[Third paragraph if necessary...]

### [Subtheme Where Table or Chart is Helpful]

*Table X: Comparative Metrics on [Topic] [INLINE_CITATION](https://source4.com)*

| Comparison Aspect | Source A [INLINE_CITATION](https://sourceA.com) | Source B [INLINE_CITATION](https://sourceB.com) |
|-------------------|--------------------------------|--------------------------------|
| Key Metric        | xx%                            | xx%                            |

[Paragraph analysis interpreting the table content...]

## Conclusion

[Synthesized findings and implications [INLINE_CITATION](https://source5.com)...]

[Discussion of limitations...]

[Recommendations for future work...]

[Final summary paragraph...]

---

**Before writing**, analyze how the sources relate.
Ensure inline citations use "[INLINE_CITATION](https://...)" formatting.
Use at least **3 full paragraphs per section**. Avoid short sections or outline-like writing.
Think like you're writing a **book chapter**, not an article — with deep reasoning, structured arguments, and fluent transitions.


${REPLY_LANGUAGE}
`),

  dataVisualizerPrompt: `You are an expert graphic designer and visual storyteller. I'm preparing a research report on a topic that will be specified by the user.

Please generate a detailed image-generation prompt that I can plug directly into Flux to produce a polished, professional cover photo for this research report.

Requirements:
- A clean, minimal layout
- Main visual element(s) should symbolize the core of the research
- No text in the image, just a nice clean professional visual

Output only the Flux-ready prompt—no explanations.`,

  planSummaryPrompt: `${getCurrentDateContext()}
You are a research assistant. Given a detailed research plan, summarize it in one short, plain sentence anyone can understand. Be brief and clear.`,
};
