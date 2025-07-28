// Test script to verify model mapping fix
const testEndpoint = async () => {
  try {
    console.log('Testing gather-search-queries endpoint...');
    
    const response = await fetch('http://localhost:3000/api/workflows/nested-research/gather-search-queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'test-session-' + Date.now(),
        query: 'What is the latest news about AI?',
        iteration: 0
      })
    });

    console.log('Response status:', response.status);
    const data = await response.text();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

testEndpoint();