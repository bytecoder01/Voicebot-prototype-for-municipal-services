const fs = require('fs');
const https = require('https');

require('dotenv').config({ path: './backend/.env' });
const VAPI_PRIVATE_API_KEY = process.env.VAPI_PRIVATE_KEY;

if (!VAPI_PRIVATE_API_KEY) {
  console.error('Error: VAPI_PRIVATE_KEY is missing from environment variables.');
  process.exit(1);
}

const configPath = './docs/vapi_agent_config.json';

try {
  // Read and parse the config file
  const configData = fs.readFileSync(configPath, 'utf8');
  let payload = configData;
  const publicUrlRaw = process.env.PUBLIC_URL || '';
  const publicUrl = publicUrlRaw.trim().replace(/\/$/, '');
  if (publicUrl) {
    payload = payload.replace(/https:\/\/YOUR_PUBLIC_URL/g, publicUrl);
  }
  if (payload.includes('YOUR_PUBLIC_URL')) {
    console.warn('WARNING: PUBLIC_URL is not set. Update backend/.env before creating the agent.');
  }

  const options = {
    hostname: 'api.vapi.ai',
    path: '/assistant',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_PRIVATE_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log('Creating Vapi assistant...');
  
  const req = https.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
      responseBody += chunk;
    });

    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('\x1b[32m%s\x1b[0m', '✅ Assistant created successfully!');
        const responseJson = JSON.parse(responseBody);
        console.log(`Assistant ID: ${responseJson.id}`);
        console.log('You can now see it in your Vapi Dashboard.');
      } else {
        console.log('\x1b[31m%s\x1b[0m', `❌ Failed to create assistant (Status: ${res.statusCode})`);
        console.log(responseBody);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error sending request:', error);
  });

  // Send the payload
  req.write(payload);
  req.end();

} catch (error) {
  console.error('Error reading configuration file:', error.message);
}