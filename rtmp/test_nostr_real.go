package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/nbd-wtf/go-nostr"
)

func main() {
	// Generate a test keypair
	sk := nostr.GeneratePrivateKey()
	pk, _ := nostr.GetPublicKey(sk)

	fmt.Printf("Generated test keypair:\n")
	fmt.Printf("Private key: %s\n", sk)
	fmt.Printf("Public key: %s\n", pk)

	// Create a test event
	event := &nostr.Event{
		PubKey:    pk,
		CreatedAt: nostr.Now(),
		Kind:      1,
		Tags:      nostr.Tags{},
		Content:   "RTMP authentication test event",
	}

	// Sign the event
	err := event.Sign(sk)
	if err != nil {
		fmt.Printf("Error signing event: %v\n", err)
		return
	}

	fmt.Printf("Signed event:\n")
	fmt.Printf("ID: %s\n", event.ID)
	fmt.Printf("Signature: %s\n", event.Sig)

	// Create auth request
	authReq := NostrAuthRequest{
		ID:        event.ID,
		PubKey:    event.PubKey,
		CreatedAt: int64(event.CreatedAt),
		Kind:      event.Kind,
		Tags:      [][]string{},
		Content:   event.Content,
		Sig:       event.Sig,
	}

	// Send to RTMP server
	jsonData, err := json.Marshal(authReq)
	if err != nil {
		fmt.Printf("Error marshaling request: %v\n", err)
		return
	}

	resp, err := http.Post("http://localhost:8080/auth/nostr", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Error sending request: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		return
	}

	var authResp NostrAuthResponse
	err = json.Unmarshal(body, &authResp)
	if err != nil {
		fmt.Printf("Error unmarshaling response: %v\n", err)
		return
	}

	if authResp.Success {
		fmt.Printf("\n✅ Authentication successful!\n")
		fmt.Printf("Stream key: %s\n", authResp.StreamKey)
		fmt.Printf("\nTest RTMP connection with:\n")
		fmt.Printf("ffmpeg -i input.mp4 -f flv rtmp://localhost:1935/live/%s\n", authResp.StreamKey)
	} else {
		fmt.Printf("\n❌ Authentication failed: %s\n", authResp.Error)
	}
}

type NostrAuthRequest struct {
	ID        string     `json:"id"`
	PubKey    string     `json:"pubkey"`
	CreatedAt int64      `json:"created_at"`
	Kind      int        `json:"kind"`
	Tags      [][]string `json:"tags"`
	Content   string     `json:"content"`
	Sig       string     `json:"sig"`
}

type NostrAuthResponse struct {
	Success   bool   `json:"success"`
	StreamKey string `json:"stream_key,omitempty"`
	Error     string `json:"error,omitempty"`
}
