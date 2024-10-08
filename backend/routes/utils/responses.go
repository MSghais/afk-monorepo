package routeutils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/AFK-AlignedFamKernel/afk_monorepo/backend/core"
)

func SetupAccessHeaders(w http.ResponseWriter) {
	config := core.AFKBackend.BackendConfig.Http

	// TODO: Process multiple origins in the future.
	if len(config.AllowOrigin) > 0 {
		w.Header().Set("Access-Control-Allow-Origin", config.AllowOrigin[0])
	}
	methods := strings.Join(config.AllowMethods, ", ")
	w.Header().Set("Access-Control-Allow-Methods", methods)

	headers := strings.Join(config.AllowHeaders, ", ")
	w.Header().Set("Access-Control-Allow-Headers", headers)
}

func SetupHeaders(w http.ResponseWriter) {
	SetupAccessHeaders(w)
	w.Header().Set("Content-Type", "application/json")
}

func BasicErrorJson(err string) []byte {
	return []byte(`{"error": "` + err + `"}`)
}

func WriteErrorJson(w http.ResponseWriter, errCode int, err string) {
	SetupHeaders(w)
	w.WriteHeader(errCode)
	w.Write(BasicErrorJson(err))
}

func BasicResultJson(result string) []byte {
	return []byte(`{"result": "` + result + `"}`)
}

func WriteResultJson(w http.ResponseWriter, result string) {
	SetupHeaders(w)
	w.WriteHeader(http.StatusOK)
	w.Write(BasicResultJson(result))
}

func BasicDataJson(data string) []byte {
	return []byte(`{"data": ` + data + `}`)
}

func WriteDataJson(w http.ResponseWriter, data string) {
	SetupHeaders(w)
	w.WriteHeader(http.StatusOK)
	w.Write(BasicDataJson(data))
}

func SendWebSocketMessage(message map[string]interface{}) {
	messageBytes, err := json.Marshal(message)
	if err != nil {
		fmt.Println("Failed to marshal websocket message")
		return
	}
	core.AFKBackend.WSConnectionsLock.Lock()
	for idx, conn := range core.AFKBackend.WSConnections {
		if err := conn.WriteMessage(websocket.TextMessage, messageBytes); err != nil {
			fmt.Println(err)
			// Remove problematic connection
			conn.Close()
			if idx < len(core.AFKBackend.WSConnections) {
				core.AFKBackend.WSConnections = append(core.AFKBackend.WSConnections[:idx], core.AFKBackend.WSConnections[idx+1:]...)
			} else {
				core.AFKBackend.WSConnections = core.AFKBackend.WSConnections[:idx]
			}
		}
	}
	core.AFKBackend.WSConnectionsLock.Unlock()
}
