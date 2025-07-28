import { togetheraiClient, openRouterClient, togetheraiClientWithKey, openRouterClientWithKey } from "./apiClients";
import { MODEL_CONFIG, TOGETHER_MODEL_CONFIG, OPENROUTER_MODEL_CONFIG } from "./config";

export type AIProvider = "together" | "openrouter";

interface ProviderStatus {
  available: boolean;
  lastError?: Error;
  lastErrorTime?: number;
  requestCount: number;
  lastRequestTime: number;
}

class AIProviderManager {
  private providers: Map<AIProvider, ProviderStatus> = new Map();
  private currentProvider: AIProvider = "together";
  private errorCooldown = 30000; // 30 seconds cooldown after error

  constructor() {
    this.providers.set("together", {
      available: true,
      requestCount: 0,
      lastRequestTime: 0,
    });
    this.providers.set("openrouter", {
      available: true,
      requestCount: 0,
      lastRequestTime: 0,
    });
  }

  private isProviderAvailable(provider: AIProvider): boolean {
    const status = this.providers.get(provider);
    if (!status) return false;
    
    // Check if provider is in error cooldown
    if (status.lastErrorTime) {
      const timeSinceError = Date.now() - status.lastErrorTime;
      if (timeSinceError < this.errorCooldown) {
        return false;
      }
      // Clear error after cooldown
      status.lastError = undefined;
      status.lastErrorTime = undefined;
    }
    
    return status.available;
  }

  private selectProvider(): AIProvider {
    // Try to use the current provider if available
    if (this.isProviderAvailable(this.currentProvider)) {
      return this.currentProvider;
    }
    
    // Switch to the other provider
    const alternativeProvider: AIProvider = this.currentProvider === "together" ? "openrouter" : "together";
    if (this.isProviderAvailable(alternativeProvider)) {
      console.log(`🔄 Switching from ${this.currentProvider} to ${alternativeProvider}`);
      this.currentProvider = alternativeProvider;
      return alternativeProvider;
    }
    
    // If both are unavailable, still try the original
    return this.currentProvider;
  }

  markProviderError(provider: AIProvider, error: Error) {
    const status = this.providers.get(provider);
    if (status) {
      status.lastError = error;
      status.lastErrorTime = Date.now();
      console.error(`❌ Error with ${provider}: ${error.message}`);
    }
  }

  markProviderSuccess(provider: AIProvider) {
    const status = this.providers.get(provider);
    if (status) {
      status.requestCount++;
      status.lastRequestTime = Date.now();
    }
  }

  getClient(model: string, apiKey?: string): { client: any; provider: AIProvider } {
    const provider = this.selectProvider();
    
    // Map model to provider-specific model name
    const providerModel = this.getProviderSpecificModel(model, provider);
    
    if (provider === "together") {
      const client = apiKey
        ? togetheraiClientWithKey(apiKey)(providerModel)
        : togetheraiClient(providerModel);
      return { client, provider };
    } else {
      // For OpenRouter, we use custom API key if provided, otherwise use default client
      const client = apiKey
        ? openRouterClientWithKey(apiKey)(providerModel)
        : openRouterClient(providerModel);
      return { client, provider };
    }
  }

  private getProviderSpecificModel(model: string, provider: AIProvider): string {
    console.log(`🔍 Mapping model "${model}" for provider "${provider}"`);
    
    // Create mapping for cross-provider model translation
    const crossProviderMapping: Record<string, Record<AIProvider, string>> = {
      "meta-llama/Llama-3.3-70B-Instruct-Turbo": {
        together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        openrouter: "meta-llama/llama-3.3-70b-instruct"
      },
      "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": {
        together: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        openrouter: "meta-llama/llama-3.1-70b-instruct"
      }
    };

    // Check if we have a direct cross-provider mapping
    if (crossProviderMapping[model]) {
      const mappedModel = crossProviderMapping[model][provider];
      if (mappedModel) {
        console.log(`  ✅ Cross-provider mapping found: ${model} → ${mappedModel}`);
        return mappedModel;
      }
    }

    // Map generic model keys to provider-specific models
    const modelConfigs = {
      together: TOGETHER_MODEL_CONFIG,
      openrouter: OPENROUTER_MODEL_CONFIG,
    };

    const config = modelConfigs[provider];
    
    // Find matching model in config
    for (const [key, value] of Object.entries(config)) {
      if (model === key || model === value) {
        console.log(`  ✅ Found match: ${key} → ${value}`);
        return value as string;
      }
    }

    // If no match found, return original model
    console.log(`  ❌ No match found, returning original: ${model}`);
    return model;
  }
}

// Singleton instance
export const aiProviderManager = new AIProviderManager();

// Helper function to get AI client with automatic failover
export function getAIClient(model: string, apiKey?: string): any {
  const { client, provider } = aiProviderManager.getClient(model, apiKey);
  
  // Wrap the client to track success/failure
  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop as keyof typeof target];
      if (typeof value === 'function') {
        return async (...args: any[]) => {
          try {
            const result = await value.apply(target, args);
            aiProviderManager.markProviderSuccess(provider);
            return result;
          } catch (error) {
            aiProviderManager.markProviderError(provider, error as Error);
            throw error;
          }
        };
      }
      return value;
    }
  });
}