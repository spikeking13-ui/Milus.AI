const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './companion/.env.local' });

const API_BASE_URL = 'http://localhost:3000/api/memory';

const testMessages = [
  { role: 'user', content: 'Hi, I am James. I like building AI agents.' }
];

async function runTest() {
  console.log('--- Starting Memory API Test ---');
  
  // 1. Store all test messages via API
  console.log('Storing messages in memory via API...');
  for (const msg of testMessages) {
    try {
      const response = await axios.post(`${API_BASE_URL}/add`, {
        text: msg.content,
        role: msg.role
      });
      if (response.data.success) {
        process.stdout.write('.');
      } else {
        console.error('\nFailed to store message:', response.data.error);
      }
    } catch (e) {
      console.error('\nError calling add API:', e.response?.data || e.message);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log('\nAll messages stored.');

  // 2. Test Retrieval via API
  console.log('\nTesting Retrieval via API for query: "What is my name and what am I building?"');
  try {
    const response = await axios.post(`${API_BASE_URL}/retrieve`, {
      query: 'What is my name and what am I building?',
      queryThreshold: 0.7,
      rerankThreshold: 0.7
    });
    
    const memories = response.data.memories;
    console.log('\nRetrieved Context:');
    if (memories && memories.length > 0) {
      memories.forEach((m, i) => console.log(`${i + 1}: ${m}`));
    } else {
      console.log('No relevant memories found.');
    }
  } catch (e) {
    console.error('Error calling retrieve API:', e.response?.data || e.message);
  }

  console.log('\n--- Test Complete ---');
}

runTest().catch(console.error);
