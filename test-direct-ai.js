// Direct test of AI provider to verify model mapping
const { getAIClient } = require('./src/deepresearch/aiProvider');
const { MODEL_CONFIG } = require('./src/deepresearch/config');

async function testModelMapping() {
  console.log('Testing AI provider model mapping...\n');
  
  // Test with summaryModel which uses Llama-3.3-70B-Instruct-Turbo
  const modelName = MODEL_CONFIG.summaryModel;
  console.log(`Testing with model: ${modelName}`);
  
  try {
    // This will trigger the model mapping logic
    const client = getAIClient(modelName);
    console.log('✅ Model client created successfully');
    
    // Try a simple generation to see if it works
    console.log('\nAttempting text generation...');
    const result = await client.generateText({
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, model mapping works!"'
        }
      ],
      maxTokens: 10
    });
    
    console.log('✅ Generation successful:', result.text);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('not a valid model ID')) {
      console.error('\n⚠️  Model mapping failed - OpenRouter rejected the model name');
    }
  }
}

testModelMapping();