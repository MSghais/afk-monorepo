#!/usr/bin/env node

/**
 * Test script for Nostr OBS Integration
 * This script tests the complete flow from Nostr event creation to stream key generation
 */

const fetch = require('node-fetch');

// Test configuration
const BACKEND_URL = 'http://localhost:5050';
const RTMP_URL = 'http://localhost:8080';
const STREAM_ID = 'test-stream-' + Date.now();

// Mock Nostr event data (in a real implementation, this would be signed)
const mockNostrEvent = {
  id: 'test-event-id-' + Date.now(),
  pubkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [
    ['stream', STREAM_ID],
    ['title', 'Test Live Stream'],
    ['t', 'livestream'],
    ['t', 'obs'],
    ['t', 'rtmp'],
    ['expiration', (Math.floor(Date.now() / 1000) + 3600).toString()]
  ],
  content: 'Test stream authentication',
  sig: 'a'.repeat(128) // Mock signature
};

async function testStreamKeyGeneration() {
  console.log('🧪 Testing Nostr OBS Integration...\n');

  try {
    // Step 1: Test stream key generation with Nostr event
    console.log('1️⃣ Testing stream key generation with Nostr event...');
    const response = await fetch(`${BACKEND_URL}/livestream/${STREAM_ID}/rtmp-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: mockNostrEvent.pubkey,
        nostrEvent: mockNostrEvent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Stream key generated successfully!');
    console.log('   Stream ID:', result.streamId);
    console.log('   Stream Key:', result.streamKey);
    console.log('   RTMP URL:', result.rtmpUrl);
    console.log('   Nostr Authenticated:', result.nostrAuthenticated);
    console.log('');

    // Step 2: Test RTMP server stream key registration
    console.log('2️⃣ Testing RTMP server stream key registration...');
    const rtmpResponse = await fetch(`${RTMP_URL}/api/stream-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        streamId: STREAM_ID,
        streamKey: result.streamKey,
        pubkey: mockNostrEvent.pubkey,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!rtmpResponse.ok) {
      const error = await rtmpResponse.text();
      throw new Error(`RTMP HTTP ${rtmpResponse.status}: ${error}`);
    }

    const rtmpResult = await rtmpResponse.json();
    console.log('✅ Stream key registered with RTMP server!');
    console.log('   Success:', rtmpResult.success);
    console.log('   Message:', rtmpResult.message);
    console.log('');

    // Step 3: Test Nostr authentication with RTMP server
    console.log('3️⃣ Testing Nostr authentication with RTMP server...');
    const authResponse = await fetch(`${RTMP_URL}/auth/nostr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockNostrEvent),
    });

    if (!authResponse.ok) {
      const error = await authResponse.text();
      throw new Error(`Auth HTTP ${authResponse.status}: ${error}`);
    }

    const authResult = await authResponse.json();
    console.log('✅ Nostr authentication successful!');
    console.log('   Success:', authResult.success);
    console.log('   Stream Key:', authResult.stream_key);
    console.log('');

    // Step 4: Test stream status endpoint
    console.log('4️⃣ Testing stream status endpoint...');
    const statusResponse = await fetch(`${BACKEND_URL}/livestream/${STREAM_ID}/status`);
    
    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      console.log('✅ Stream status retrieved!');
      console.log('   Status:', JSON.stringify(statusResult, null, 2));
    } else {
      console.log('⚠️ Stream status endpoint not available (this is normal for new streams)');
    }

    console.log('\n🎉 All tests passed! Nostr OBS integration is working correctly.');
    console.log('\n📋 OBS Configuration:');
    console.log(`   RTMP URL: ${result.rtmpUrl}`);
    console.log(`   Stream Key: ${result.streamKey}`);
    console.log('\n🔧 To test with OBS Studio:');
    console.log('   1. Open OBS Studio');
    console.log('   2. Go to Settings → Stream');
    console.log('   3. Set Service to "Custom"');
    console.log(`   4. Set Server to: ${result.rtmpUrl.split('/').slice(0, -1).join('/')}`);
    console.log(`   5. Set Stream Key to: ${result.streamKey}`);
    console.log('   6. Click OK and start streaming');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure data-backend is running on port 5050');
    console.error('   2. Make sure RTMP server is running on port 8080');
    console.error('   3. Check that all services are properly configured');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testStreamKeyGeneration();
}

module.exports = { testStreamKeyGeneration };
