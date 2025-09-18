#!/usr/bin/env node

/**
 * Debug script for OBS Integration
 * This script tests each step of the integration to identify issues
 */

const fetch = require('node-fetch');

// Test configuration
const BACKEND_URL = 'http://localhost:5050';
const RTMP_URL = 'http://localhost:8080';
const STREAM_ID = 'debug-stream-' + Date.now();

// Mock Nostr event data (properly formatted)
const mockNostrEvent = {
  id: 'test-event-id-' + Date.now(),
  pubkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [
    ['stream', STREAM_ID],
    ['title', 'Debug Live Stream'],
    ['t', 'livestream'],
    ['t', 'obs'],
    ['t', 'rtmp'],
    ['expiration', (Math.floor(Date.now() / 1000) + 3600).toString()],
    ['d', STREAM_ID]
  ],
  content: 'Debug stream authentication',
  sig: 'a'.repeat(128) // Mock signature
};

async function testBackendConnection() {
  console.log('🔍 Testing backend connection...');
  try {
    const response = await fetch(`${BACKEND_URL}/livestream/health`);
    if (response.ok) {
      console.log('✅ Backend is running');
      return true;
    } else {
      console.log('❌ Backend health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Backend connection failed:', error.message);
    return false;
  }
}

async function testRtmpConnection() {
  console.log('🔍 Testing RTMP server connection...');
  try {
    const response = await fetch(`${RTMP_URL}/auth/nostr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockNostrEvent)
    });
    
    if (response.ok) {
      console.log('✅ RTMP server is running');
      return true;
    } else {
      const error = await response.text();
      console.log('❌ RTMP server error:', error);
      return false;
    }
  } catch (error) {
    console.log('❌ RTMP server connection failed:', error.message);
    return false;
  }
}

async function testStreamKeyGeneration() {
  console.log('🔍 Testing stream key generation...');
  try {
    const response = await fetch(`${BACKEND_URL}/livestream/${STREAM_ID}/rtmp-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: mockNostrEvent.pubkey,
        nostrEvent: mockNostrEvent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ Stream key generation failed:', error);
      return null;
    }

    const result = await response.json();
    console.log('✅ Stream key generated successfully');
    console.log('   Stream ID:', result.streamId);
    console.log('   Stream Key:', result.streamKey);
    console.log('   RTMP URL:', result.rtmpUrl);
    console.log('   Nostr Authenticated:', result.nostrAuthenticated);
    
    return result;
  } catch (error) {
    console.log('❌ Stream key generation error:', error.message);
    return null;
  }
}

async function testRtmpKeyRegistration(streamKey) {
  console.log('🔍 Testing RTMP key registration...');
  try {
    const response = await fetch(`${RTMP_URL}/api/stream-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamId: STREAM_ID,
        streamKey: streamKey,
        pubkey: mockNostrEvent.pubkey,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ RTMP key registration failed:', error);
      return false;
    }

    const result = await response.json();
    console.log('✅ RTMP key registered successfully');
    console.log('   Success:', result.success);
    console.log('   Message:', result.message);
    
    return true;
  } catch (error) {
    console.log('❌ RTMP key registration error:', error.message);
    return false;
  }
}

async function testStreamKeyValidation(streamKey) {
  console.log('🔍 Testing stream key validation...');
  try {
    // Test with a simple HTTP request to see if the key is registered
    const response = await fetch(`${RTMP_URL}/auth/nostr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockNostrEvent)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Stream key validation successful');
      console.log('   Generated Key:', result.stream_key);
      console.log('   Matches expected:', result.stream_key === streamKey);
      return result.stream_key === streamKey;
    } else {
      const error = await response.text();
      console.log('❌ Stream key validation failed:', error);
      return false;
    }
  } catch (error) {
    console.log('❌ Stream key validation error:', error.message);
    return false;
  }
}

async function testOBSConfiguration(rtmpUrl, streamKey) {
  console.log('🔍 Testing OBS configuration...');
  
  // Extract server and key from RTMP URL
  const urlParts = rtmpUrl.split('/');
  const server = urlParts.slice(0, -1).join('/');
  const key = urlParts[urlParts.length - 1];
  
  console.log('📋 OBS Configuration:');
  console.log(`   Server: ${server}`);
  console.log(`   Stream Key: ${key}`);
  console.log(`   Expected Key: ${streamKey}`);
  console.log(`   Keys Match: ${key === streamKey}`);
  
  if (key === streamKey) {
    console.log('✅ OBS configuration is correct');
    return true;
  } else {
    console.log('❌ OBS configuration mismatch');
    return false;
  }
}

async function runDebugTests() {
  console.log('🚀 Starting OBS Integration Debug Tests\n');
  
  // Test 1: Backend connection
  const backendOk = await testBackendConnection();
  if (!backendOk) {
    console.log('\n❌ Backend is not running. Please start the data-backend service.');
    return;
  }
  
  // Test 2: RTMP server connection
  const rtmpOk = await testRtmpConnection();
  if (!rtmpOk) {
    console.log('\n❌ RTMP server is not running. Please start the RTMP server.');
    return;
  }
  
  // Test 3: Stream key generation
  const keyResult = await testStreamKeyGeneration();
  if (!keyResult) {
    console.log('\n❌ Stream key generation failed.');
    return;
  }
  
  // Test 4: RTMP key registration
  const registrationOk = await testRtmpKeyRegistration(keyResult.streamKey);
  if (!registrationOk) {
    console.log('\n❌ RTMP key registration failed.');
    return;
  }
  
  // Test 5: Stream key validation
  const validationOk = await testStreamKeyValidation(keyResult.streamKey);
  if (!validationOk) {
    console.log('\n❌ Stream key validation failed.');
    return;
  }
  
  // Test 6: OBS configuration
  const obsConfigOk = await testOBSConfiguration(keyResult.rtmpUrl, keyResult.streamKey);
  if (!obsConfigOk) {
    console.log('\n❌ OBS configuration is incorrect.');
    return;
  }
  
  console.log('\n🎉 All tests passed! OBS integration should work correctly.');
  console.log('\n📋 Final OBS Configuration:');
  console.log(`   Server: ${keyResult.rtmpUrl.split('/').slice(0, -1).join('/')}`);
  console.log(`   Stream Key: ${keyResult.streamKey}`);
  console.log('\n🔧 To test with OBS Studio:');
  console.log('   1. Open OBS Studio');
  console.log('   2. Go to Settings → Stream');
  console.log('   3. Set Service to "Custom"');
  console.log(`   4. Set Server to: ${keyResult.rtmpUrl.split('/').slice(0, -1).join('/')}`);
  console.log(`   5. Set Stream Key to: ${keyResult.streamKey}`);
  console.log('   6. Click OK and start streaming');
}

// Run the debug tests
if (require.main === module) {
  runDebugTests().catch(console.error);
}

module.exports = { runDebugTests };
