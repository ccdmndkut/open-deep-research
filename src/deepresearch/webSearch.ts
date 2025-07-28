import z from "zod";
import { SearchResult } from "./schemas";

const JINA_READER_URL = "https://r.jina.ai/";
const JINA_SEARCH_URL = "https://s.jina.ai/";
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

type SearchResults = {
  results: SearchResult[];
};

// Add delay function for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Track last API call time for rate limiting
let lastBraveApiCall = 0;

// Brave Search implementation
async function searchWithBrave(query: string): Promise<any[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return [];
  }

  // Rate limiting: Ensure at least 1.1 seconds between Brave API calls
  const now = Date.now();
  const timeSinceLastCall = now - lastBraveApiCall;
  if (timeSinceLastCall < 1100) {
    const waitTime = 1100 - timeSinceLastCall;
    console.log(`⏳ Rate limiting: waiting ${waitTime}ms before Brave API call`);
    await delay(waitTime);
  }
  lastBraveApiCall = Date.now();
  
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
        query
      )}&count=5&result_filter=web`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        } as HeadersInit,
      }
    );
    
    console.log(`📡 Brave API response status: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      console.error(`❌ Brave API request failed: ${res.status} ${res.statusText}`);
      const errorText = await res.text();
      
      // Parse error to check if it's a rate limit
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.code === "RATE_LIMITED") {
          console.log(`⚠️ Brave API rate limit hit.`);
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      return [];
    }

    const responseJson = await res.json();
    
    let parsedResponseJson;
    try {
      parsedResponseJson = z
        .object({
          web: z.object({
            results: z.array(
              z.object({
                url: z.string(),
                title: z.string(),
                meta_url: z.object({
                  favicon: z.string(),
                }),
                extra_snippets: z.array(z.string()).default([]),
                thumbnail: z
                  .object({
                    original: z.string(),
                  })
                  .optional(),
              })
            ),
          }),
        })
        .parse(responseJson);
        
      return parsedResponseJson.web.results;
    } catch (zodError) {
      console.error(`❌ Brave response parsing failed:`, zodError);
      return [];
    }
  } catch (error) {
    console.error(`❌ Brave Search error:`, error);
    return [];
  }
}

// Jina Search implementation
async function searchWithJina(query: string): Promise<any[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return [];
  }

  try {
    console.log(`🔍 Using Jina Search for: "${query}"`);
    
    const response = await fetch(`${JINA_SEARCH_URL}${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Jina Search failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    // Jina returns results in a different format, need to normalize
    if (data.data && Array.isArray(data.data)) {
      return data.data.slice(0, 5).map((result: any) => ({
        url: result.url,
        title: result.title || result.url,
        meta_url: { favicon: "" },
        extra_snippets: [result.description || result.snippet || ""],
        thumbnail: undefined,
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`❌ Jina Search error:`, error);
    return [];
  }
}

// Tavily Search implementation
async function searchWithTavily(query: string): Promise<any[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return [];
  }

  try {
    console.log(`🔍 Using Tavily Search for: "${query}"`);
    
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced",
        include_answer: false,
        include_raw_content: true,  // Get the full content
        max_results: 5,
      }),
    });

    if (!response.ok) {
      console.error(`❌ Tavily Search failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`❌ Tavily error:`, errorText);
      return [];
    }

    const data = await response.json();
    
    // Tavily returns high-quality, pre-processed results
    if (data.results && Array.isArray(data.results)) {
      return data.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        meta_url: { favicon: "" },
        extra_snippets: [result.content || ""],
        thumbnail: undefined,
        // Tavily provides a score we can use for ranking
        score: result.score || 0,
        // Tavily provides pre-extracted content
        raw_content: result.raw_content || null,
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`❌ Tavily Search error:`, error);
    return [];
  }
}

export const searchOnWeb = async ({
  query,
}: {
  query: string;
}): Promise<SearchResults> => {
  console.log(`🔍 Starting web search for query: "${query}"`);
  
  // Check which search services are available
  const hasTavily = process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim() !== "";
  const hasBrave = process.env.BRAVE_API_KEY && process.env.BRAVE_API_KEY.trim() !== "";
  const hasJina = process.env.JINA_API_KEY && process.env.JINA_API_KEY.trim() !== "";
  
  if (!hasTavily && !hasBrave && !hasJina) {
    console.error(`❌ No search API keys configured (need TAVILY_API_KEY, BRAVE_API_KEY, or JINA_API_KEY)`);
    return { results: [] };
  }
  
  let searchResults: any[] = [];
  
  // Strategy: Try Tavily first (best for AI research), then Brave, then Jina
  if (hasTavily) {
    console.log(`🔍 Trying Tavily Search (optimized for AI)...`);
    searchResults = await searchWithTavily(query);
  }
  
  // If Tavily failed or returned no results, try Brave
  if (searchResults.length === 0 && hasBrave) {
    console.log(`🔍 Falling back to Brave Search...`);
    searchResults = await searchWithBrave(query);
  }
  
  // If both Tavily and Brave failed, try Jina
  if (searchResults.length === 0 && hasJina) {
    console.log(`🔍 Falling back to Jina Search...`);
    searchResults = await searchWithJina(query);
  }
  
  // If we still have no results, return empty
  if (searchResults.length === 0) {
    console.log(`⚠️ No search results found from any provider`);
    return { results: [] };
  }

  // Check if we're using Tavily (which provides content)
  const usingTavily = hasTavily && searchResults.length > 0 && searchResults[0].raw_content;
  
  if (usingTavily) {
    // Tavily already provides content, no need to scrape
    console.log(`✅ Using Tavily's pre-extracted content, skipping Jina scraping`);
    
    const results = searchResults
      .filter((r) => r.raw_content || r.extra_snippets?.[0])
      .map((r) => ({
        title: r.title,
        link: r.url,
        content: r.raw_content || r.extra_snippets?.[0] || "",
      }))
      .filter((r) => r.content !== "");
    
    console.log(`✅ Tavily provided ${results.length} results with content`);
    
    if (results.length === 0) {
      return { results: [] };
    }
    return { results };
  }
  
  // For non-Tavily searches, we need to scrape with Jina
  console.log(`📄 Using Jina Reader to scrape content from search results`);
  
  // Normalize the results
  const parsedResults = searchResults.map((r) => ({
    title: r.title,
    url: r.url,
    favicon: r.meta_url?.favicon || "",
    extraSnippets: r.extra_snippets || [],
    thumbnail: r.thumbnail?.original,
  }));

  // Validate and type results
  const searchResultSchema = z.object({
    title: z.string(),
    url: z.string(),
    favicon: z.string(),
    extraSnippets: z.array(z.string()).default([]),
    thumbnail: z.string().optional(),
  });
  type SearchResult = z.infer<typeof searchResultSchema>;
  const schema = z.array(searchResultSchema);
  const validatedResults = schema.parse(parsedResults);

  // Scrape each result with Jina Reader
  async function scrapeSearchResult(searchResult: SearchResult) {
    let scrapedText = "";
    
    try {
      const jinaResponse = await fetch(
        `${JINA_READER_URL}${searchResult.url}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.JINA_API_KEY}`,
            "X-Return-Format": "markdown",
            "X-Timeout": "15",
          },
        }
      );
      
      if (jinaResponse.ok) {
        const rawText = await jinaResponse.text();
        scrapedText = stripUrlsFromMarkdown(rawText).substring(0, 80_000);
      } else {
        console.warn(
          "Error scraping",
          searchResult.url,
          " with Jina.",
          jinaResponse.status,
          jinaResponse.statusText
        );
      }
    } catch (e) {
      console.warn("Error scraping", searchResult.url, " with Jina.", e);
    }
    
    return {
      title: searchResult.title,
      link: searchResult.url,
      content: scrapedText,
    };
  }

  const resultsSettled = await Promise.allSettled(
    validatedResults.map(scrapeSearchResult)
  );

  const results = resultsSettled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<any>).value)
    .filter((r) => r.content !== "");

  console.log(`✅ Successfully scraped ${results.length} results`);
  
  if (results.length === 0) {
    return { results: [] };
  }
  return { results };
};

// Markdown stripping helper
function stripUrlsFromMarkdown(markdown: string): string {
  let result = markdown;
  result = result.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g,
    "$1"
  );
  result = result.replace(
    /\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g,
    "$1"
  );
  result = result.replace(
    /^\[[^\]]+\]:\s*https?:\/\/[^\s]+(?:\s+"[^"]*")?$/gm,
    ""
  );
  result = result.replace(/<(https?:\/\/[^>]+)>/g, "");
  result = result.replace(/https?:\/\/[^\s]+/g, "");
  return result.trim();
}