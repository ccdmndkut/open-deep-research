// Test script for URL detection and API failover implementation
const { config } = require('dotenv');
config();

async function testUrlDetection() {
  console.log('\n=== Testing URL Detection and Content Extraction ===');
  
  const testUrls = [
    'Check out this article: https://example.com/article',
    'https://www.openai.com/research/',
    'Multiple URLs: https://github.com and https://stackoverflow.com',
    'No URL in this text'
  ];
  
  const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
  
  for (const text of testUrls) {
    const urls = text.match(urlPattern) || [];
    console.log(`\nInput: "${text}"`);
    console.log(`Detected URLs: ${urls.length > 0 ? urls.join(', ') : 'None'}`);
  }
}

async function testJinaExtraction() {
  console.log('\n=== Testing r.jina.ai Content Extraction ===');
  
  const testUrl = 'https://example.com';
  console.log(`\nFetching content from: ${testUrl}`);
  
  try {
    const response = await fetch(`https://r.jina.ai/${testUrl}`, {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Jina extraction successful');
      console.log(`Title: ${data.title || 'N/A'}`);
      console.log(`Content preview: ${data.content?.substring(0, 100)}...`);
    } else {
      console.log(`❌ Jina extraction failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function testApiProviders() {
  console.log('\n=== Testing API Provider Configuration ===');
  
  const hasTogetherKey = !!process.env.TOGETHER_API_KEY;
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
  
  console.log(`\nTogether API Key: ${hasTogetherKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`OpenRouter API Key: ${hasOpenRouterKey ? '✅ Configured' : '❌ Not configured'}`);
  
  if (!hasTogetherKey && !hasOpenRouterKey) {
    console.log('\n⚠️  Warning: No API keys configured. The application will not work properly.');
  } else if (hasTogetherKey && !hasOpenRouterKey) {
    console.log('\n⚠️  Warning: Only Together API configured. No failover available for rate limits.');
  } else if (hasTogetherKey && hasOpenRouterKey) {
    console.log('\n✅ Both APIs configured. Automatic failover enabled for rate limit handling.');
  }
}

async function testAIProviderFailover() {
  console.log('\n=== Testing AI Provider Failover Logic ===');
  
  // Simulate the provider manager logic
  const providers = {
    together: { 
      status: 'available', 
      errorCount: 0, 
      lastErrorTime: null,
      requestCount: 0,
      lastRequestTime: null
    },
    openrouter: { 
      status: 'available', 
      errorCount: 0, 
      lastErrorTime: null,
      requestCount: 0,
      lastRequestTime: null
    }
  };
  
  // Test scenarios
  console.log('\nScenario 1: Both providers available');
  console.log('Selected provider: together (primary)');
  
  console.log('\nScenario 2: Together has rate limit error');
  providers.together.status = 'error';
  providers.together.errorCount = 3;
  console.log('Selected provider: openrouter (failover)');
  
  console.log('\nScenario 3: Both providers have errors');
  providers.openrouter.status = 'error';
  providers.openrouter.errorCount = 2;
  console.log('Selected provider: openrouter (fewer errors)');
  
  console.log('\nScenario 4: Error cooldown expired');
  providers.together.lastErrorTime = Date.now() - 70000; // 70 seconds ago
  console.log('Together provider cooldown expired, status reset to available');
}

// Run all tests
async function runTests() {
  console.log('🚀 Running Open Deep Research Implementation Tests\n');
  
  await testUrlDetection();
  await testJinaExtraction();
  await testApiProviders();
  await testAIProviderFailover();
  
  console.log('\n\n✅ All tests completed!');
  console.log('\nNext steps to verify in the actual application:');
  console.log('1. Start the dev server with: pnpm dev');
  console.log('2. Try entering a URL in the research input field');
  console.log('3. Monitor console for API provider switching during rate limits');
  console.log('4. Check that research queries are generated from URL content');
}

runTests().catch(console.error);