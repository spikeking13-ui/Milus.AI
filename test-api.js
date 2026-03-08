const fetch = require('node-fetch');

async function testStreaming() {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Tell me a short story about a robot learning to paint.' }
      ],
    }),
  });

  if (!response.ok) {
    console.error('Error:', await response.text());
    return;
  }

  const reader = response.body;
  reader.on('data', (chunk) => {
    process.stdout.write(chunk.toString());
  });

  reader.on('end', () => {
    console.log('\n\nStream finished.');
  });
}

testStreaming().catch(console.error);
