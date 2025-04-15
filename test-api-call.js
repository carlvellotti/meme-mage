// test-api-call.js
const fetch = require('node-fetch');

async function testScrapeReels() {
  const url = 'http://localhost:3000/api/scrape-reels';
  
  // Instagram Reel URL to test
  const instagramUrl = 'https://www.instagram.com/reels/DIbYpKHR3xj/';
  
  console.log(`Sending POST request to ${url} with Instagram URL: ${instagramUrl}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [instagramUrl]
      }),
    });
    
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response data:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testScrapeReels(); 