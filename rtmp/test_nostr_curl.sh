#!/bin/bash

echo "Testing Nostr Authentication with RTMP Server"
echo "============================================="

# Test with a simple (invalid) signature first
echo "1. Testing with invalid signature..."
curl -X POST http://localhost:8080/auth/nostr \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test123",
    "pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "created_at": '$(date +%s)',
    "kind": 1,
    "tags": [],
    "content": "test",
    "sig": "invalid_signature"
  }'

echo -e "\n\n2. Testing with valid format but fake signature..."
curl -X POST http://localhost:8080/auth/nostr \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test123",
    "pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "created_at": '$(date +%s)',
    "kind": 1,
    "tags": [],
    "content": "test",
    "sig": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'

echo -e "\n\n3. Testing with old timestamp..."
curl -X POST http://localhost:8080/auth/nostr \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test123",
    "pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "created_at": 1000000000,
    "kind": 1,
    "tags": [],
    "content": "test",
    "sig": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'

echo -e "\n\nFor a real test, run: go run test_nostr_real.go"
