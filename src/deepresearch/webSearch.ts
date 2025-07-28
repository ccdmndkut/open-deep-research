import z from "zod";
import { SearchResult } from "./schemas";

const JINA_READER_URL = "https://r.jina.ai/";

type SearchResults = {
  results: SearchResult[];
};

export const searchOnWeb = async ({
  query,
}: {
  query: string;
}): Promise<SearchResults> => {
  console.log(`🔍 Starting web search for query: "${query}"`);
  
  // Check if API key is configured
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.error(`❌ BRAVE_API_KEY is missing or empty`);
    console.log(`⚠️ Returning empty results due to missing API key`);
    return { results: [] };
  }
  
  // 1. Call Brave Search API for web results
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
    console.error(`❌ Error response body:`, errorText);
    
    // Return empty results instead of throwing to prevent workflow from getting stuck
    console.log(`⚠️ Returning empty results due to API error`);
    return { results: [] };
  }
  
  const responseJson = await res.json();
  console.log(`📊 Raw Brave API response structure:`, {
    hasWeb: 'web' in responseJson,
    topLevelKeys: Object.keys(responseJson),
    webProperty: responseJson.web ? 'exists' : 'missing',
    webKeys: responseJson.web ? Object.keys(responseJson.web) : 'N/A'
  });
  
  // Add detailed logging of the actual response
  console.log(`📋 Full response JSON:`, JSON.stringify(responseJson, null, 2));
  
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
  } catch (zodError) {
    console.error(`❌ Zod parsing failed for query "${query}":`, zodError);
    console.error(`❌ Response that failed parsing:`, JSON.stringify(responseJson, null, 2));
    
    // Check if this is a rate limit or API error response
    if (responseJson.error || responseJson.message) {
      console.error(`❌ API returned error:`, {
        error: responseJson.error,
        message: responseJson.message,
        code: responseJson.code
      });
    }
    
    // Return empty results instead of throwing to prevent workflow from getting stuck
    console.log(`⚠️ Returning empty results due to parsing error`);
    return { results: [] };
  }

  const parsedResults = parsedResponseJson.web.results.map((r) => ({
    title: r.title,
    url: r.url,
    favicon: r.meta_url.favicon,
    extraSnippets: r.extra_snippets,
    thumbnail: r.thumbnail?.original,
  }));

  // 2. Validate and type results
  const searchResultSchema = z.object({
    title: z.string(),
    url: z.string(),
    favicon: z.string(),
    extraSnippets: z.array(z.string()).default([]),
    thumbnail: z.string().optional(),
  });
  type SearchResult = z.infer<typeof searchResultSchema>;
  const schema = z.array(searchResultSchema);
  const searchResults = schema.parse(parsedResults);

  // 4. Scrape each result with Jina
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
    searchResults.map(scrapeSearchResult)
  );

  const results = resultsSettled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<any>).value)
    .filter((r) => r.content !== "");

  if (results.length === 0) {
    return { results: [] };
  }
  return { results };
};

// 3. Markdown stripping helper
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
