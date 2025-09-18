package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
	"unsafe"

	"github.com/gorilla/websocket"
	"github.com/nbd-wtf/go-nostr"
)

const (
	rtmpPort          = 1935
	inChunkSize       = 128 // inbound chunk size we assume for peer until we change it (we keep 128)
	defaultOutCsidCtl = 2   // control
	defaultOutCsidCmd = 3   // commands
)

// Stream key management
var validStreamKeys = map[string]bool{
	"test123":     true,
	"live_key_1":  true,
	"stream_abc":  true,
	"demo_stream": true,
	"secret_key":  true,
	"my_live_key": true,
}

// Nostr authentication structures (matching algo-relay format)
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

// Dynamic stream keys generated from Nostr authentication
var nostrStreamKeys = make(map[string]string)   // pubkey -> stream_key
var streamKeyToPubkey = make(map[string]string) // stream_key -> pubkey

// WebSocket connection to data-backend
var dataBackendConn *websocket.Conn
var dataBackendUrl = "ws://localhost:5050/ws"

// Connect to data-backend WebSocket
func connectToDataBackend() {
	for {
		conn, _, err := websocket.DefaultDialer.Dial(dataBackendUrl, nil)
		if err != nil {
			fmt.Printf("Failed to connect to data-backend WebSocket: %v\n", err)
			time.Sleep(5 * time.Second)
			continue
		}

		dataBackendConn = conn
		fmt.Println("✅ Connected to data-backend WebSocket")

		// Handle incoming messages
		go func() {
			for {
				_, message, err := conn.ReadMessage()
				if err != nil {
					fmt.Printf("WebSocket read error: %v\n", err)
					break
				}

				var msg map[string]interface{}
				if err := json.Unmarshal(message, &msg); err != nil {
					fmt.Printf("Failed to parse WebSocket message: %v\n", err)
					continue
				}

				handleWebSocketMessage(msg)
			}
		}()

		// Keep connection alive
		conn.SetPingHandler(func(string) error {
			return conn.WriteMessage(websocket.PongMessage, nil)
		})

		// Wait for connection to close
		conn.Close()
		dataBackendConn = nil
		fmt.Println("❌ Disconnected from data-backend WebSocket, reconnecting...")
		time.Sleep(5 * time.Second)
	}
}

// Handle WebSocket messages from data-backend
func handleWebSocketMessage(msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "stream-started":
		streamKey, _ := msg["streamKey"].(string)
		pubkey, _ := msg["pubkey"].(string)
		fmt.Printf("📡 Stream started notification: %s (pubkey: %s)\n", streamKey, pubkey[:8]+"...")

	case "stream-ended":
		streamKey, _ := msg["streamKey"].(string)
		fmt.Printf("📡 Stream ended notification: %s\n", streamKey)

	case "stream-key-registered":
		streamKey, _ := msg["streamKey"].(string)
		pubkey, _ := msg["pubkey"].(string)
		fmt.Printf("📡 Stream key registered notification: %s (pubkey: %s)\n", streamKey, pubkey[:8]+"...")

	default:
		fmt.Printf("📡 Unknown WebSocket message type: %s\n", msgType)
	}
}

// Send message to data-backend
func sendToDataBackend(msg map[string]interface{}) {
	if dataBackendConn == nil {
		fmt.Println("⚠️ No connection to data-backend")
		return
	}

	if err := dataBackendConn.WriteJSON(msg); err != nil {
		fmt.Printf("Failed to send message to data-backend: %v\n", err)
	}
}

// AddStreamKey adds a new valid stream key
func addStreamKey(key string) {
	validStreamKeys[key] = true
	fmt.Printf("Added stream key: %s\n", key)
}

// RemoveStreamKey removes a stream key
func removeStreamKey(key string) {
	delete(validStreamKeys, key)
	fmt.Printf("Removed stream key: %s\n", key)
}

// ListStreamKeys returns all valid stream keys (for debugging)
func listStreamKeys() []string {
	keys := make([]string, 0, len(validStreamKeys))
	for key := range validStreamKeys {
		keys = append(keys, key)
	}
	return keys
}

// ---------- AMF0 minimal (String, Number, Boolean, Null, Object) ----------
type amf0Val interface{}

func amf0WriteString(b *[]byte, s string) {
	*b = append(*b, 0x02)
	l := uint16(len(s))
	tmp := make([]byte, 2)
	binary.BigEndian.PutUint16(tmp, l)
	*b = append(*b, tmp...)
	*b = append(*b, []byte(s)...)
}
func amf0WriteNumber(b *[]byte, n float64) {
	*b = append(*b, 0x00)
	tmp := make([]byte, 8)
	binary.BigEndian.PutUint64(tmp, mathFloat64ToBits(n))
	*b = append(*b, tmp...)
}
func amf0WriteBoolean(b *[]byte, v bool) {
	*b = append(*b, 0x01)
	if v {
		*b = append(*b, 1)
	} else {
		*b = append(*b, 0)
	}
}
func amf0WriteNull(b *[]byte) { *b = append(*b, 0x05) }
func amf0WriteObject(b *[]byte, fields [][2]amf0Val) {
	*b = append(*b, 0x03)
	for _, kv := range fields {
		k := kv[0].(string)
		v := kv[1]
		tmp := make([]byte, 2)
		binary.BigEndian.PutUint16(tmp, uint16(len(k)))
		*b = append(*b, tmp...)
		*b = append(*b, []byte(k)...)
		amf0WriteValue(b, v)
	}
	*b = append(*b, 0x00, 0x00, 0x09)
}
func amf0WriteValue(b *[]byte, v amf0Val) {
	switch t := v.(type) {
	case string:
		amf0WriteString(b, t)
	case float64:
		amf0WriteNumber(b, t)
	case bool:
		amf0WriteBoolean(b, t)
	case nil:
		amf0WriteNull(b)
	case [][2]amf0Val: // object as slice of [key,val]
		amf0WriteObject(b, t)
	default:
		amf0WriteNull(b)
	}
}

// Tiny AMF0 read for first two fields (command name + txnId)
func amf0ReadValue(p []byte) (amf0Val, int, bool) {
	if len(p) == 0 {
		return nil, 0, false
	}
	switch p[0] {
	case 0x02: // string
		if len(p) < 3 {
			return nil, 0, false
		}
		l := int(binary.BigEndian.Uint16(p[1:3]))
		if len(p) < 3+l {
			return nil, 0, false
		}
		return string(p[3 : 3+l]), 3 + l, true
	case 0x00: // number
		if len(p) < 9 {
			return nil, 0, false
		}
		n := bitsToFloat64(binary.BigEndian.Uint64(p[1:9]))
		return n, 9, true
	case 0x01: // boolean
		if len(p) < 2 {
			return nil, 0, false
		}
		return p[1] != 0, 2, true
	case 0x05: // null
		return nil, 1, true
	case 0x03: // object — naive skip to end marker
		idx := 1
		for idx+3 <= len(p) {
			if p[idx] == 0 && p[idx+1] == 0 && p[idx+2] == 0x09 {
				return [][2]amf0Val{}, idx + 3, true
			}
			if idx+2 > len(p) {
				return nil, 0, false
			}
			l := int(binary.BigEndian.Uint16(p[idx : idx+2]))
			idx += 2 + l // key
			if idx >= len(p) {
				return nil, 0, false
			}
			switch p[idx] {
			case 0x02:
				if idx+3 > len(p) {
					return nil, 0, false
				}
				sl := int(binary.BigEndian.Uint16(p[idx+1 : idx+3]))
				idx += 3 + sl
			case 0x00:
				idx += 9
			case 0x01:
				idx += 2
			case 0x05:
				idx += 1
			case 0x03:
				// bail out for nested object; treat as consumed
				return [][2]amf0Val{}, len(p), true
			default:
				return nil, 0, false
			}
		}
		return nil, 0, false
	default:
		return nil, 0, false
	}
}

// ---------- utils for float bits (no math pkg needed) ----------
func mathFloat64ToBits(f float64) uint64 { return *(*uint64)(unsafe.Pointer(&f)) }
func bitsToFloat64(u uint64) float64     { return *(*float64)(unsafe.Pointer(&u)) }

// ---------- RTMP writer (fmt0 only, single-chunk payload ok, with ext TS) ----------
func writeChunk(w io.Writer, csid uint8, timestamp uint32, msgType uint8, msgStreamID uint32, payload []byte) error {
	// Basic header: fmt=0, csid (3..63 assumed)
	bh := []byte{(0 << 6) | (csid & 0x3F)}
	if _, err := w.Write(bh); err != nil {
		return err
	}

	// Message header (fmt0): ts(3), len(3), type(1), msgStreamID(4 LE)
	ts := timestamp & 0xFFFFFF
	mh := []byte{byte(ts >> 16), byte(ts >> 8), byte(ts)}
	ml := uint32(len(payload))
	mh = append(mh, byte(ml>>16), byte(ml>>8), byte(ml))
	mh = append(mh, msgType)
	ms := make([]byte, 4)
	binary.LittleEndian.PutUint32(ms, msgStreamID)
	mh = append(mh, ms...)

	// Handle extended timestamp
	if timestamp >= 0xFFFFFF {
		mh[0] = 0xFF
		mh[1] = 0xFF
		mh[2] = 0xFF
		ext := make([]byte, 4)
		binary.BigEndian.PutUint32(ext, timestamp)
		mh = append(mh, ext...)
	}

	if _, err := w.Write(mh); err != nil {
		return err
	}
	_, err := w.Write(payload)
	return err
}

func writeAMF0Command(w io.Writer, csid uint8, msgStreamID uint32, values ...amf0Val) error {
	buf := make([]byte, 0, 256)
	for _, v := range values {
		amf0WriteValue(&buf, v)
	}
	return writeChunk(w, csid, 0, 20, msgStreamID, buf)
}

// ---------- RTMP Handshake ----------
func handshake(conn net.Conn) error {
	// C0
	c0 := make([]byte, 1)
	if _, err := io.ReadFull(conn, c0); err != nil {
		return err
	}
	if c0[0] != 0x03 {
		return fmt.Errorf("unsupported RTMP version: %d", c0[0])
	}
	// C1
	c1 := make([]byte, 1536)
	if _, err := io.ReadFull(conn, c1); err != nil {
		return err
	}
	// S0
	if _, err := conn.Write([]byte{0x03}); err != nil {
		return err
	}
	// S1
	s1 := make([]byte, 1536)
	now := uint32(time.Now().Unix())
	binary.BigEndian.PutUint32(s1[0:4], now)
	// s1[4:8] = zero
	rand.Read(s1[8:])
	if _, err := conn.Write(s1); err != nil {
		return err
	}
	// S2: echo c1
	s2 := make([]byte, 1536)
	copy(s2[0:4], c1[0:4])
	copy(s2[4:8], s1[0:4])
	copy(s2[8:], c1[8:])
	if _, err := conn.Write(s2); err != nil {
		return err
	}
	// C2
	c2 := make([]byte, 1536)
	_, err := io.ReadFull(conn, c2)
	return err
}

// ---------- Inbound message reassembly (fmt0 + fmt1 + fmt2 + fmt3 continuations, with ext TS) ----------
type rtmpMsg struct {
	csid        uint8
	msgType     uint8
	msgStreamID uint32
	timestamp   uint32
	payload     []byte
}

type chunkState struct {
	csid        uint8
	msgType     uint8
	msgStreamID uint32
	timestamp   uint32
	msgLen      uint32
	got         int
	payload     []byte
}

// Global chunk state map for tracking partial messages
var chunkStates = make(map[uint8]*chunkState)

// ---------- Authentication ----------
func extractStreamKey(payload []byte) (string, error) {
	// Parse AMF0 command: "publish", txnId, null, streamName, mode
	// We need to skip the first two values (command name and txnId)
	offset := 0

	// Skip command name
	_, n, ok := amf0ReadValue(payload[offset:])
	if !ok {
		return "", fmt.Errorf("failed to read command name")
	}
	offset += n

	// Skip transaction ID
	_, n, ok = amf0ReadValue(payload[offset:])
	if !ok {
		return "", fmt.Errorf("failed to read transaction ID")
	}
	offset += n

	// Skip null (usually present)
	_, n, ok = amf0ReadValue(payload[offset:])
	if !ok {
		return "", fmt.Errorf("failed to read null value")
	}
	offset += n

	// Read stream name (this is our stream key)
	streamName, n, ok := amf0ReadValue(payload[offset:])
	if !ok {
		return "", fmt.Errorf("failed to read stream name")
	}

	key, ok := streamName.(string)
	if !ok {
		return "", fmt.Errorf("stream name is not a string")
	}

	return key, nil
}

func validateStreamKey(streamKey string) bool {
	fmt.Printf("🔍 Validating stream key: %s\n", streamKey)
	
	// Check static stream keys first
	if validStreamKeys[streamKey] {
		fmt.Printf("✅ Valid static stream key: %s\n", streamKey)
		return true
	}

	// Check if it's a Nostr-generated stream key
	_, exists := streamKeyToPubkey[streamKey]
	if exists {
		fmt.Printf("✅ Valid Nostr stream key: %s\n", streamKey)
		return true
	}
	
	fmt.Printf("❌ Invalid stream key: %s\n", streamKey)
	fmt.Printf("Available static keys: %v\n", getStaticKeys())
	fmt.Printf("Available Nostr keys: %d\n", len(nostrStreamKeys))
	
	return false
}

// Helper function to get static keys for debugging
func getStaticKeys() []string {
	keys := make([]string, 0, len(validStreamKeys))
	for key := range validStreamKeys {
		keys = append(keys, key)
	}
	return keys
}

// generateStreamKeyFromPubkey creates a deterministic stream key from a Nostr pubkey
func generateStreamKeyFromPubkey(pubkey string) string {
	// Create a deterministic hash from pubkey + current hour
	now := time.Now()
	hour := now.Truncate(time.Hour).Unix()

	data := fmt.Sprintf("%s:%d", pubkey, hour)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])[:16] // Use first 16 characters
}

// verifyNostrSignature verifies a Nostr event signature using proper nostr.Event
func verifyNostrSignature(authReq *NostrAuthRequest) bool {
	// Create nostr.Event from the request data (matching algo-relay approach)
	nostrTags := nostr.Tags{}
	for _, tag := range authReq.Tags {
		nostrTags = append(nostrTags, nostr.Tag(tag))
	}

	event := &nostr.Event{
		ID:        authReq.ID,
		PubKey:    authReq.PubKey,
		CreatedAt: nostr.Timestamp(authReq.CreatedAt),
		Kind:      authReq.Kind,
		Tags:      nostrTags,
		Content:   authReq.Content,
		Sig:       authReq.Sig,
	}

	// Verify the signature using the proper nostr method
	ok, err := event.CheckSignature()
	if err != nil {
		fmt.Printf("Nostr signature verification error: %v\n", err)
		return false
	}
	return ok
}

// authenticateWithNostr handles Nostr-based authentication
func authenticateWithNostr(pubkey string) (string, error) {
	// Check if we already have a valid stream key for this pubkey
	if streamKey, exists := nostrStreamKeys[pubkey]; exists {
		return streamKey, nil
	}

	// Generate new stream key
	streamKey := generateStreamKeyFromPubkey(pubkey)

	// Store the mapping
	nostrStreamKeys[pubkey] = streamKey
	streamKeyToPubkey[streamKey] = pubkey

	fmt.Printf("Generated Nostr stream key for pubkey %s: %s\n", pubkey, streamKey)
	return streamKey, nil
}

func readMsg(conn net.Conn) (rtmpMsg, error) {
	var msg rtmpMsg

	// Read basic header
	bh := make([]byte, 1)
	if _, err := io.ReadFull(conn, bh); err != nil {
		return msg, err
	}

	fmtVal := bh[0] >> 6
	csid := bh[0] & 0x3F

	// Handle extended CSID
	if csid == 0 {
		ext := make([]byte, 1)
		if _, err := io.ReadFull(conn, ext); err != nil {
			return msg, err
		}
		csid = ext[0] + 64
	} else if csid == 1 {
		ext := make([]byte, 2)
		if _, err := io.ReadFull(conn, ext); err != nil {
			return msg, err
		}
		csid = uint8(binary.BigEndian.Uint16(ext) + 64)
	}

	var state *chunkState
	var exists bool

	switch fmtVal {
	case 0: // fmt0: full message header
		mh := make([]byte, 11)
		if _, err := io.ReadFull(conn, mh); err != nil {
			return msg, err
		}

		timestamp := uint32(mh[0])<<16 | uint32(mh[1])<<8 | uint32(mh[2])
		msgLen := uint32(mh[3])<<16 | uint32(mh[4])<<8 | uint32(mh[5])
		msgType := mh[6]
		msgStreamID := binary.LittleEndian.Uint32(mh[7:11])

		// Handle extended timestamp
		if timestamp == 0xFFFFFF {
			ext := make([]byte, 4)
			if _, err := io.ReadFull(conn, ext); err != nil {
				return msg, err
			}
			timestamp = binary.BigEndian.Uint32(ext)
			fmt.Printf("Extended timestamp: %d\n", timestamp)
		}

		state = &chunkState{
			csid:        csid,
			msgType:     msgType,
			msgStreamID: msgStreamID,
			timestamp:   timestamp,
			msgLen:      msgLen,
			got:         0,
			payload:     make([]byte, 0, msgLen),
		}
		chunkStates[csid] = state

	case 1: // fmt1: timestamp delta + length + type
		state, exists = chunkStates[csid]
		if !exists {
			return msg, fmt.Errorf("fmt1 without previous state for csid %d", csid)
		}

		mh := make([]byte, 7)
		if _, err := io.ReadFull(conn, mh); err != nil {
			return msg, err
		}

		tsDelta := uint32(mh[0])<<16 | uint32(mh[1])<<8 | uint32(mh[2])
		msgLen := uint32(mh[3])<<16 | uint32(mh[4])<<8 | uint32(mh[5])
		msgType := mh[6]

		// Handle extended timestamp delta
		if tsDelta == 0xFFFFFF {
			ext := make([]byte, 4)
			if _, err := io.ReadFull(conn, ext); err != nil {
				return msg, err
			}
			tsDelta = binary.BigEndian.Uint32(ext)
		}

		state.timestamp += tsDelta
		state.msgLen = msgLen
		state.msgType = msgType
		state.got = 0

	case 2: // fmt2: timestamp delta only
		state, exists = chunkStates[csid]
		if !exists {
			return msg, fmt.Errorf("fmt2 without previous state for csid %d", csid)
		}

		mh := make([]byte, 3)
		if _, err := io.ReadFull(conn, mh); err != nil {
			return msg, err
		}

		tsDelta := uint32(mh[0])<<16 | uint32(mh[1])<<8 | uint32(mh[2])

		// Handle extended timestamp delta
		if tsDelta == 0xFFFFFF {
			ext := make([]byte, 4)
			if _, err := io.ReadFull(conn, ext); err != nil {
				return msg, err
			}
			tsDelta = binary.BigEndian.Uint32(ext)
		}

		state.timestamp += tsDelta
		state.got = 0

	case 3: // fmt3: no message header
		state, exists = chunkStates[csid]
		if !exists {
			return msg, fmt.Errorf("fmt3 without previous state for csid %d", csid)
		}
		// No changes to state

	default:
		return msg, fmt.Errorf("unsupported chunk format: %d", fmtVal)
	}

	// Read payload
	toRead := int(minU32(state.msgLen-uint32(state.got), inChunkSize))

	if toRead > 0 {
		tmp := make([]byte, toRead)
		if _, err := io.ReadFull(conn, tmp); err != nil {
			return msg, err
		}
		state.payload = append(state.payload, tmp...)
		state.got += toRead
	}

	// If message is complete, return it and clean up state
	if state.got >= int(state.msgLen) {
		msg.csid = state.csid
		msg.msgType = state.msgType
		msg.msgStreamID = state.msgStreamID
		msg.timestamp = state.timestamp
		msg.payload = state.payload
		delete(chunkStates, csid)
		return msg, nil
	}

	// Message not complete, return empty message (caller should continue reading)
	return rtmpMsg{}, nil
}

func minU32(a, b uint32) uint32 {
	if a < b {
		return a
	}
	return b
}

// ---------- Session ----------
func handleConn(conn net.Conn) {
	defer conn.Close()
	fmt.Printf("> client %s\n", conn.RemoteAddr())
	if err := handshake(conn); err != nil {
		fmt.Println("handshake error:", err)
		return
	}
	fmt.Println("handshake ok")

	// Control: Window Acknowledgement Size (type 5)
	was := make([]byte, 4)
	binary.BigEndian.PutUint32(was, 0x000FFFFF)
	if err := writeChunk(conn, defaultOutCsidCtl, 0, 5, 0, was); err != nil {
		fmt.Println("write was err:", err)
		return
	}
	// Control: Set Peer Bandwidth (type 6), limit type 2
	spb := append(was, 2)
	if err := writeChunk(conn, defaultOutCsidCtl, 0, 6, 0, spb); err != nil {
		fmt.Println("write spb err:", err)
		return
	}
	// Control: Set Chunk Size (type 1) — affects what WE send (outbound). We keep inbound at 128 in this toy.
	outChunk := make([]byte, 4)
	binary.BigEndian.PutUint32(outChunk, 4096)
	if err := writeChunk(conn, defaultOutCsidCtl, 0, 1, 0, outChunk); err != nil {
		fmt.Println("write setchunk err:", err)
		return
	}

	// Expect "connect"
	msg, err := readMsg(conn)
	if err != nil {
		fmt.Println("read connect err:", err)
		return
	}
	if msg.msgType != 20 {
		fmt.Println("expected AMF0 command first")
		return
	}
	cmd, n0, ok := amf0ReadValue(msg.payload)
	if !ok {
		fmt.Println("amf0 read #0 failed")
		return
	}
	txn, _, ok := amf0ReadValue(msg.payload[n0:])
	if !ok {
		fmt.Println("amf0 read #1 failed")
		return
	}
	_ = cmd // usually "connect"
	txnID, _ := txn.(float64)
	// Reply: _result
	if err := writeAMF0Command(conn, defaultOutCsidCmd, 0,
		"_result", txnID,
		[][2]amf0Val{
			{"fmsVer", "FMS/3,5,7,7009"},
			{"capabilities", float64(31)},
		},
		[][2]amf0Val{
			{"level", "status"},
			{"code", "NetConnection.Connect.Success"},
			{"description", "Connection succeeded."},
			{"objectEncoding", float64(0)},
		},
	); err != nil {
		fmt.Println("write connect _result err:", err)
		return
	}
	fmt.Println("sent connect _result")

	streamID := uint32(1)

	for {
		m, err := readMsg(conn)
		if err != nil {
			if err == io.EOF {
				return
			}
			fmt.Println("read msg err:", err)
			return
		}

		// Skip empty messages (partial messages that need more chunks)
		if len(m.payload) == 0 && m.msgType == 0 {
			continue
		}

		switch m.msgType {
		case 20: // AMF0 command
			nameV, u0, ok := amf0ReadValue(m.payload)
			if !ok {
				continue
			}
			txnV, _, ok := amf0ReadValue(m.payload[u0:])
			if !ok {
				continue
			}
			name, _ := nameV.(string)
			tid, _ := txnV.(float64)
			fmt.Printf("cmd: %s (txn=%.0f)\n", name, tid)
			switch name {
			case "createStream":
				// _result, txn, null, streamID
				if err := writeAMF0Command(conn, defaultOutCsidCmd, 0,
					"_result", tid, nil, float64(streamID),
				); err != nil {
					fmt.Println("write createStream _result err:", err)
					return
				}
			case "publish":
				// Extract and validate stream key
				streamKey, err := extractStreamKey(m.payload)
				if err != nil {
					fmt.Printf("Failed to extract stream key: %v\n", err)
					// Send error response
					if err := writeAMF0Command(conn, defaultOutCsidCmd, streamID,
						"onStatus", float64(0), nil,
						[][2]amf0Val{
							{"level", "error"},
							{"code", "NetStream.Publish.BadName"},
							{"description", "Invalid stream key format."},
						},
					); err != nil {
						fmt.Println("write publish error onStatus err:", err)
						return
					}
					continue
				}

				// Validate stream key
				if !validateStreamKey(streamKey) {
					fmt.Printf("Invalid stream key: %s\n", streamKey)
					// Send error response
					if err := writeAMF0Command(conn, defaultOutCsidCmd, streamID,
						"onStatus", float64(0), nil,
						[][2]amf0Val{
							{"level", "error"},
							{"code", "NetStream.Publish.BadName"},
							{"description", "Invalid stream key. Access denied."},
						},
					); err != nil {
						fmt.Println("write publish error onStatus err:", err)
						return
					}
					continue
				}

				// Stream key is valid, send success response
				if _, isNostr := streamKeyToPubkey[streamKey]; isNostr {
					pubkey := streamKeyToPubkey[streamKey]
					fmt.Printf("Valid Nostr stream key: %s (pubkey: %s)\n", streamKey, pubkey[:8]+"...")
				} else {
					fmt.Printf("Valid static stream key: %s\n", streamKey)
				}
				if err := writeAMF0Command(conn, defaultOutCsidCmd, streamID,
					"onStatus", float64(0), nil,
					[][2]amf0Val{
						{"level", "status"},
						{"code", "NetStream.Publish.Start"},
						{"description", "Publish ok."},
					},
				); err != nil {
					fmt.Println("write publish onStatus err:", err)
					return
				}
				fmt.Println("publish acknowledged")
			default:
				// ignore others (releaseStream, FCPublish, etc.)
			}
		case 8, 9:
			// audio/video payloads — discard
		default:
			// ignore other types
		}
	}
}

// HTTP handler for receiving stream keys from data-backend
func handleStreamKeyRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		StreamID  string `json:"streamId"`
		StreamKey string `json:"streamKey"`
		Pubkey    string `json:"pubkey"`
		Timestamp string `json:"timestamp"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request format: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Add the stream key to our valid keys
	addStreamKey(req.StreamKey)

	// Store the mapping for Nostr authentication
	nostrStreamKeys[req.Pubkey] = req.StreamKey
	streamKeyToPubkey[req.StreamKey] = req.Pubkey

	fmt.Printf("✅ Stream key registered: %s (pubkey: %s)\n", req.StreamKey, req.Pubkey[:8]+"...")

	// Notify data-backend about the stream key registration
	sendToDataBackend(map[string]interface{}{
		"type":      "stream-key-registered",
		"streamKey": req.StreamKey,
		"pubkey":    req.Pubkey,
		"streamId":  req.StreamID,
		"timestamp": req.Timestamp,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   "Stream key registered successfully",
		"streamKey": req.StreamKey,
	})
}

// HTTP handler for Nostr authentication
func handleNostrAuth(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var authReq NostrAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&authReq); err != nil {
		sendNostrAuthResponse(w, false, "", "Invalid request format: "+err.Error())
		return
	}

	// Verify signature using proper nostr.Event verification
	if !verifyNostrSignature(&authReq) {
		sendNostrAuthResponse(w, false, "", "Invalid signature")
		return
	}

	// Check if event is recent (within 5 minutes)
	eventTime := time.Unix(authReq.CreatedAt, 0)
	if time.Since(eventTime) > 5*time.Minute {
		sendNostrAuthResponse(w, false, "", "Authentication event is too old")
		return
	}

	// Generate stream key
	streamKey, err := authenticateWithNostr(authReq.PubKey)
	if err != nil {
		sendNostrAuthResponse(w, false, "", "Failed to generate stream key: "+err.Error())
		return
	}

	sendNostrAuthResponse(w, true, streamKey, "")
}

func sendNostrAuthResponse(w http.ResponseWriter, success bool, streamKey, errorMsg string) {
	w.Header().Set("Content-Type", "application/json")

	response := NostrAuthResponse{
		Success:   success,
		StreamKey: streamKey,
		Error:     errorMsg,
	}

	json.NewEncoder(w).Encode(response)
}

// Admin interface for managing stream keys
func adminInterface() {
	scanner := bufio.NewScanner(os.Stdin)
	fmt.Println("Admin commands:")
	fmt.Println("  add <key>     - Add a static stream key")
	fmt.Println("  remove <key>  - Remove a static stream key")
	fmt.Println("  list          - List all stream keys (static + Nostr)")
	fmt.Println("  nostr         - List Nostr stream keys")
	fmt.Println("  quit          - Exit server")

	for {
		fmt.Print("admin> ")
		if !scanner.Scan() {
			break
		}

		line := strings.TrimSpace(scanner.Text())
		parts := strings.Fields(line)

		if len(parts) == 0 {
			continue
		}

		switch parts[0] {
		case "add":
			if len(parts) < 2 {
				fmt.Println("Usage: add <key>")
				continue
			}
			addStreamKey(parts[1])
		case "remove":
			if len(parts) < 2 {
				fmt.Println("Usage: remove <key>")
				continue
			}
			removeStreamKey(parts[1])
		case "list":
			fmt.Printf("Static stream keys: %v\n", listStreamKeys())
			fmt.Printf("Nostr stream keys: %d active\n", len(nostrStreamKeys))
			for pubkey, streamKey := range nostrStreamKeys {
				fmt.Printf("  %s -> %s\n", pubkey[:8]+"...", streamKey)
			}
		case "nostr":
			fmt.Printf("Nostr stream keys (%d active):\n", len(nostrStreamKeys))
			for pubkey, streamKey := range nostrStreamKeys {
				fmt.Printf("  %s -> %s\n", pubkey, streamKey)
			}
		case "quit":
			fmt.Println("Shutting down server...")
			os.Exit(0)
		default:
			fmt.Println("Unknown command. Use: add, remove, list, or quit")
		}
	}
}

func main() {
	rand.Seed(time.Now().UnixNano())

	// Start WebSocket connection to data-backend
	go connectToDataBackend()

	// Start HTTP server for Nostr authentication and stream key registration
	http.HandleFunc("/auth/nostr", handleNostrAuth)
	http.HandleFunc("/api/stream-key", handleStreamKeyRegistration)
	go func() {
		fmt.Println("HTTP server for Nostr auth and stream key registration listening on :8080")
		if err := http.ListenAndServe(":8080", nil); err != nil {
			fmt.Printf("HTTP server error: %v\n", err)
		}
	}()

	// Start RTMP server
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", rtmpPort))
	if err != nil {
		panic(err)
	}
	fmt.Printf("RTMP (stdlib-only) listening on :%d\n", rtmpPort)
	fmt.Printf("Static stream keys: %v\n", listStreamKeys())
	fmt.Println("Connect with: rtmp://localhost:1935/live/<stream_key>")
	fmt.Println("Nostr auth endpoint: http://localhost:8080/auth/nostr")
	fmt.Println("Nostr stream keys are generated dynamically and rotate hourly")

	// Start admin interface in a goroutine
	go adminInterface()

	for {
		c, err := ln.Accept()
		if err != nil {
			continue
		}
		go handleConn(c)
	}
}
