// Simple rate limiter for Together.ai API calls
class RateLimiter {
  private lastCallTime: number = 0;
  private minDelay: number;

  constructor(requestsPerSecond: number = 1) {
    this.minDelay = 1000 / requestsPerSecond;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastCall;
      console.log(`⏳ Rate limiting Together.ai: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }
}

// Create a singleton rate limiter for Together.ai (1 request per second)
export const togetherRateLimiter = new RateLimiter(1);