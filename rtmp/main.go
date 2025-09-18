package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"math/rand"
	"net"
	"time"
	"unsafe"
)

const (
	rtmpPort          = 1935
	inChunkSize       = 128 // inbound chunk size we assume for peer until we change it (we keep 128)
	defaultOutCsidCtl = 2   // control
	defaultOutCsidCmd = 3   // commands
)

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

// ---------- RTMP writer (fmt0 only, single-chunk payload ok) ----------
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

// ---------- Inbound message reassembly (fmt0 + fmt3 continuations, no ext TS) ----------
type rtmpMsg struct {
	csid        uint8
	msgType     uint8
	msgStreamID uint32
	payload     []byte
}

func readMsg(conn net.Conn) (rtmpMsg, error) {
	var msg rtmpMsg
	var timestamp uint32
	var msgLen uint32
	var got int

	// first chunk header (fmt0)
	bh := make([]byte, 1)
	if _, err := io.ReadFull(conn, bh); err != nil {
		return msg, err
	}
	fmtVal := bh[0] >> 6
	csid := bh[0] & 0x3F
	if fmtVal != 0 {
		return msg, fmt.Errorf("only fmt0 first chunk supported")
	}

	mh := make([]byte, 11)
	if _, err := io.ReadFull(conn, mh); err != nil {
		return msg, err
	}
	timestamp = uint32(mh[0])<<16 | uint32(mh[1])<<8 | uint32(mh[2])
	msgLen = uint32(mh[3])<<16 | uint32(mh[4])<<8 | uint32(mh[5])
	msgType := mh[6]
	msgStreamID := binary.LittleEndian.Uint32(mh[7:11])

	payload := make([]byte, 0, msgLen)

	toRead := int(minU32(msgLen, inChunkSize))
	tmp := make([]byte, toRead)
	if _, err := io.ReadFull(conn, tmp); err != nil {
		return msg, err
	}
	payload = append(payload, tmp...)
	got += toRead

	// continuation chunks (fmt3)
	for got < int(msgLen) {
		// basic header again
		if _, err := io.ReadFull(conn, bh); err != nil {
			return msg, err
		}
		if (bh[0]>>6) != 3 || (bh[0]&0x3F) != csid {
			return msg, fmt.Errorf("expected fmt3 continuation on same csid")
		}
		remain := int(msgLen) - got
		chunk := remain
		if chunk > inChunkSize {
			chunk = inChunkSize
		}
		tmp = tmp[:chunk]
		if _, err := io.ReadFull(conn, tmp); err != nil {
			return msg, err
		}
		payload = append(payload, tmp...)
		got += chunk
	}

	msg.csid = csid
	msg.msgType = msgType
	msg.msgStreamID = msgStreamID
	msg.payload = payload
	_ = timestamp
	return msg, nil
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
				// onStatus on NetStream
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

func main() {
	rand.Seed(time.Now().UnixNano())
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", rtmpPort))
	if err != nil {
		panic(err)
	}
	fmt.Printf("RTMP (stdlib-only) listening on :%d\n", rtmpPort)
	for {
		c, err := ln.Accept()
		if err != nil {
			continue
		}
		go handleConn(c)
	}
}
