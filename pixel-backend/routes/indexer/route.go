package indexer

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"sync"

	routeutils "github.com/AFK_AlignedFamKernel/afk_monorepo/pixel-backend/routes/utils"
)

func InitIndexerRoutes() {
	http.HandleFunc("/consume-indexer-msg", consumeIndexerMsg)
	// http.HandleFunc("/enable-turboda", enableTurboda)
	// http.HandleFunc("/disable-turboda", disableTurboda)
}

type IndexerCursor struct {
	OrderKey  int    `json:"orderKey"`
	UniqueKey string `json:"uniqueKey"`
}

type IndexerEvent struct {
	Event struct {
		FromAddress string   `json:"fromAddress"`
		Keys        []string `json:"keys"`
		Data        []string `json:"data"`
	} `json:"event"`
}

type IndexerMessage struct {
	Data struct {
		Cursor    IndexerCursor `json:"cursor"`
		EndCursor IndexerCursor `json:"end_cursor"`
		Finality  string        `json:"finality"`
		Batch     []struct {
			Status string         `json:"status"`
			Events []IndexerEvent `json:"events"`
		} `json:"batch"`
	} `json:"data"`
}

// TODO: When will there be multiple events in a batch?
//       Try interacting with multiple contracts in a single block

// TODO: Pointers?
// TODO: Load on init
var LatestPendingMessage *IndexerMessage
var LastProcessedPendingMessage *IndexerMessage
var PendingMessageLock = &sync.Mutex{}
var LastAcceptedEndKey int
var AcceptedMessageQueue []IndexerMessage
var AcceptedMessageLock = &sync.Mutex{}
var LastFinalizedCursor int
var FinalizedMessageQueue []IndexerMessage
var FinalizedMessageLock = &sync.Mutex{}

const (
	newDayEvent                      = "0x00df776faf675d0c64b0f2ec596411cf1509d3966baba3478c84771ddbac1784"
	colorAddedEvent                  = "0x0004a301e4d01f413a1d4d0460c4ba976e23392f49126d90f5bd45de7dd7dbeb"
	pixelPlacedEvent                 = "0x02d7b50ebf415606d77c7e7842546fc13f8acfbfd16f7bcf2bc2d08f54114c23"
	basicPixelPlacedEvent            = "0x03089ae3085e1c52442bb171f26f92624095d32dc8a9c57c8fb09130d32daed8"
	factionPixelsPlacedEvent         = "0x02838056c6784086957f2252d4a36a24d554ea2db7e09d2806cc69751d81f0a2"
	chainFactionPixelsPlacedEvent    = "0x02e4d1feaacd0627a6c7d5002564bdb4ca4877d47f00cad4714201194690a7a9"
	extraPixelsPlacedEvent           = "0x000e8f5c4e6f651bf4c7b093805f85c9b8ec2ec428210f90a4c9c135c347f48c"
	dailyQuestClaimedEvent           = "0x02025eddbc0f68a923d76519fb336e0fe1e0d6b9053ab3a504251bbd44201b10"
	mainQuestClaimedEvent            = "0x0121172d5bc3847c8c39069075125e53d3225741d190df6d52194cb5dd5d2049"
	voteColorEvent                   = "0x02407c82b0efa2f6176a075ba5a939d33eefab39895fabcf3ac1c5e897974a40"
	votableColorAddedEvent           = "0x0115b3bc605487276e022f4bec68b316e7a6b3615fb01afee58241fd1d40e3e5"
	factionCreatedEvent              = "0x00f3878d4c85ed94271bb611f83d47ea473bae501ffed34cd21b73206149f692"
	factionLeaderChangedEvent        = "0x00aa4bacdfcf2717835a46fbd64f7d39bfdf2b4404bc5af8e5660415d1dc2848"
	factionJoinedEvent               = "0x01e3fbdf8156ad0dde21e886d61a16d85c9ef54451eb6e253f3f427de32a47ac"
	factionLeftEvent                 = "0x014ef8cc25c96157e2a00e9ceaa7c014a162d11d58a98871087ec488a67d7925"
	chainFactionCreatedEvent         = "0x020c994ab49a8316bcc78b06d4ff9929d83b2995af33f480b93e972cedb0c926"
	chainFactionJoinedEvent          = "0x02947960ff713d9b594a3b718b90a45360e46d1bbacef94b727bb0d461d04207"
	nftMintedEvent                   = "0x030826e0cd9a517f76e857e3f3100fe5b9098e9f8216d3db283fb4c9a641232f"
	nftLikedEvent                    = "0x028d7ee09447088eecdd12a86c9467a5e9ad18f819a20f9adcf6e34e0bd51453"
	nftUnlikedEvent                  = "0x03b57514b19693484c35249c6e8b15bfe6e476205720680c2ff9f02faaf94941"
	usernameClaimedEvent             = "0x019be6537c04b790ae4e3a06d6e777ec8b2e9950a01d76eed8a2a28941cc511c"
	usernameChangedEvent             = "0x03c44b98666b0a27eadcdf5dc42449af5f907b19523858368c4ffbc7a2625dab"
	nftTransferEvent                 = "0x0099cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9"
	factionTemplateAddedEvent        = "0x026ab80224b4bc3543bf20cd8b66304b3591c05eac775d823e1970514881757f"
	factionTemplateRemovedEvent      = "0x029a976c0074fc910f3a6a58f1351c48dab7b1c539f54ed930616292c806283f"
	chainFactionTemplateAddedEvent   = "0x00476f35ea27024c89c1fc05dfad873e9e93419e452ee781e8207e435289a39b"
	chainFactionTemplateRemovedEvent = "0x0126718de7cb8b83dfa258eb095bc0ec7a3ef5a2258ebd1ed349551764856c6b"
	hostAwardedPixelsEvent           = "0x03cab98018a5e38e0cf717d8bed481983eb400f6a1d9ccd34f87050c0f36a32a"
	canvasCreatedEvent               = "0x0003fddf2e955d6c8fbd5ec6e98da32f7e9ebe7731b86b4ef7de342b165222e0"
	canvasHostChangedEvent           = "0x00569981649f1a25a7a012ccf216e9c0f807068f8ba4689ee58c2d55df22cc45"
	canvasPixelsPerTimeChangedEvent  = "0x0053fef88f7744f78868b97051032869570d31ef6be6c86e2c60ca33b8d4b49d"
	canvasTimerChangedEvent          = "0x02e1eccce24e49cc4ab3df0795f173bbe667dd4fddbc52c8af731b4e2ad78cf5"
	canvasStartTimeChangedEvent      = "0x029dcf060d1b84c30a9a0c25f8c9b0bcb841557eb482d198524fef77e8879673"
	canvasEndTimeChangedEvent        = "0x0208008de905364fb24915201b629fe7bcbc4adeced02a2696df5e1c48758acd"
	canvasColorAddedEvent            = "0x03e856f8abfe58c8841f552ce76651ebff20c1550d167b3a18b049b7552fe8a2"
	canvasPixelPlacedEvent           = "0x02adf9f56e1f4e16a3e116f34424bd26cb5fc45363498015b4c007835318f7bb"
	canvasBasicPixelPlacedEvent      = "0x03066baa9c37a42082799e6bc6426ff7d4dc8a635ed9dfc444d0d3c51e605a6b"
	canvasExtraPixelsPlacedEvent     = "0x01e42e4d6ca5843bfd4e86e344db6c418b295c23bed38831a7ec9b4a83148830"
	canvasHostAwardedUserEvent       = "0x01bf6ede8c6c232cee1830a5227fd638383f5af669701289d113492b1d41fda5"
	canvasFavoritedEvent             = "0x032105bd4f21a32bc92e45a49b30eab9355f7f89619d87e9801628e3acc5b502"
	canvasUnfavoritedEvent           = "0x014ee6480f95acb4b7286d3a7f95b6033299e66e502cfb4b207ccf088b5f601d"
	stencilAddedEvent                = "0x03384fcf8ff5c539c31feec6626511aa15ae53dba7459fd3a3c67af615ef6b5d"
	stencilRemovedEvent              = "0x023c933ed3ee3f94b5b82f8e2e570c8354e6f5036c3a079092ceeed15979e7fa"
	stencilFavoritedEvent            = "0x007cb4ae927fb597834e194e2c950a2d813461c72f372f78d0610ea246f53017"
	stencilUnfavoritedEvent          = "0x00a5477c7df6522316b652e56317e69e52429ab43a6772fb6f6c2a574f7e196f"
)

var eventProcessors = map[string](func(IndexerEvent)){
	newDayEvent:                      processNewDayEvent,
	colorAddedEvent:                  processColorAddedEvent,
	pixelPlacedEvent:                 processPixelPlacedEvent,
	basicPixelPlacedEvent:            processBasicPixelPlacedEvent,
	factionPixelsPlacedEvent:         processFactionPixelsPlacedEvent,
	chainFactionPixelsPlacedEvent:    processChainFactionPixelsPlacedEvent,
	extraPixelsPlacedEvent:           processExtraPixelsPlacedEvent,
	dailyQuestClaimedEvent:           processDailyQuestClaimedEvent,
	mainQuestClaimedEvent:            processMainQuestClaimedEvent,
	voteColorEvent:                   processVoteColorEvent,
	votableColorAddedEvent:           processVotableColorAddedEvent,
	factionCreatedEvent:              processFactionCreatedEvent,
	factionLeaderChangedEvent:        processFactionLeaderChangedEvent,
	factionJoinedEvent:               processFactionJoinedEvent,
	factionLeftEvent:                 processFactionLeftEvent,
	chainFactionCreatedEvent:         processChainFactionCreatedEvent,
	chainFactionJoinedEvent:          processChainFactionJoinedEvent,
	nftMintedEvent:                   processNFTMintedEvent,
	nftLikedEvent:                    processNFTLikedEvent,
	nftUnlikedEvent:                  processNFTUnlikedEvent,
	usernameClaimedEvent:             processUsernameClaimedEvent,
	usernameChangedEvent:             processUsernameChangedEvent,
	nftTransferEvent:                 processNFTTransferEvent,
	factionTemplateAddedEvent:        processFactionTemplateAddedEvent,
	factionTemplateRemovedEvent:      processFactionTemplateRemovedEvent,
	chainFactionTemplateAddedEvent:   processChainFactionTemplateAddedEvent,
	chainFactionTemplateRemovedEvent: processChainFactionTemplateRemovedEvent,
	hostAwardedPixelsEvent:           processHostAwardedPixelsEvent,
	canvasCreatedEvent:               processCanvasCreatedEvent,
	canvasHostChangedEvent:           processCanvasHostChangedEvent,
	canvasPixelsPerTimeChangedEvent:  processCanvasPixelsPerTimeChangedEvent,
	canvasTimerChangedEvent:          processCanvasTimerChangedEvent,
	canvasStartTimeChangedEvent:      processCanvasStartTimeChangedEvent,
	canvasEndTimeChangedEvent:        processCanvasEndTimeChangedEvent,
	canvasColorAddedEvent:            processCanvasColorAddedEvent,
	canvasPixelPlacedEvent:           processCanvasPixelPlacedEvent,
	canvasBasicPixelPlacedEvent:      processCanvasBasicPixelPlacedEvent,
	canvasExtraPixelsPlacedEvent:     processCanvasExtraPixelsPlacedEvent,
	canvasHostAwardedUserEvent:       processCanvasHostAwardedUserEvent,
	canvasFavoritedEvent:             processCanvasFavoritedEvent,
	canvasUnfavoritedEvent:           processCanvasUnfavoritedEvent,
	stencilAddedEvent:                processStencilAddedEvent,
	stencilRemovedEvent:              processStencilRemovedEvent,
	stencilFavoritedEvent:            processStencilFavoritedEvent,
	stencilUnfavoritedEvent:          processStencilUnfavoritedEvent,
}

var eventReverters = map[string](func(IndexerEvent)){
	newDayEvent:                      revertNewDayEvent,
	colorAddedEvent:                  revertColorAddedEvent,
	pixelPlacedEvent:                 revertPixelPlacedEvent,
	basicPixelPlacedEvent:            revertBasicPixelPlacedEvent,
	factionPixelsPlacedEvent:         revertFactionPixelsPlacedEvent,
	chainFactionPixelsPlacedEvent:    revertChainFactionPixelsPlacedEvent,
	extraPixelsPlacedEvent:           revertExtraPixelsPlacedEvent,
	dailyQuestClaimedEvent:           revertDailyQuestClaimedEvent,
	mainQuestClaimedEvent:            revertMainQuestClaimedEvent,
	voteColorEvent:                   revertVoteColorEvent,
	votableColorAddedEvent:           revertVotableColorAddedEvent,
	factionCreatedEvent:              revertFactionCreatedEvent,
	factionLeaderChangedEvent:        revertFactionLeaderChangedEvent,
	factionJoinedEvent:               revertFactionJoinedEvent,
	factionLeftEvent:                 revertFactionLeftEvent,
	chainFactionCreatedEvent:         revertChainFactionCreatedEvent,
	chainFactionJoinedEvent:          revertChainFactionJoinedEvent,
	nftMintedEvent:                   revertNFTMintedEvent,
	nftLikedEvent:                    revertNFTLikedEvent,
	nftUnlikedEvent:                  revertNFTUnlikedEvent,
	usernameClaimedEvent:             revertUsernameClaimedEvent,
	usernameChangedEvent:             revertUsernameChangedEvent,
	nftTransferEvent:                 revertNFTTransferEvent,
	factionTemplateAddedEvent:        revertFactionTemplateAddedEvent,
	factionTemplateRemovedEvent:      revertFactionTemplateRemovedEvent,
	chainFactionTemplateAddedEvent:   revertChainFactionTemplateAddedEvent,
	chainFactionTemplateRemovedEvent: revertChainFactionTemplateRemovedEvent,
	hostAwardedPixelsEvent:           revertHostAwardedPixelsEvent,
	canvasCreatedEvent:               revertCanvasCreatedEvent,
	canvasHostChangedEvent:           revertCanvasHostChangedEvent,
	canvasPixelsPerTimeChangedEvent:  revertCanvasPixelsPerTimeChangedEvent,
	canvasTimerChangedEvent:          revertCanvasTimerChangedEvent,
	canvasStartTimeChangedEvent:      revertCanvasStartTimeChangedEvent,
	canvasEndTimeChangedEvent:        revertCanvasEndTimeChangedEvent,
	canvasColorAddedEvent:            revertCanvasColorAddedEvent,
	canvasPixelPlacedEvent:           revertCanvasPixelPlacedEvent,
	canvasBasicPixelPlacedEvent:      revertCanvasBasicPixelPlacedEvent,
	canvasExtraPixelsPlacedEvent:     revertCanvasExtraPixelsPlacedEvent,
	canvasHostAwardedUserEvent:       revertCanvasHostAwardedUserEvent,
	canvasFavoritedEvent:             revertCanvasFavoritedEvent,
	canvasUnfavoritedEvent:           revertCanvasUnfavoritedEvent,
	stencilAddedEvent:                revertStencilAddedEvent,
	stencilRemovedEvent:              revertStencilRemovedEvent,
	stencilFavoritedEvent:            revertStencilFavoritedEvent,
	stencilUnfavoritedEvent:          revertStencilUnfavoritedEvent,
}

// TODO: Rethink this ( & look at values before multicanvas PR )
var eventRequiresOrdering = map[string]bool{
	newDayEvent:                      true,
	colorAddedEvent:                  true,
	pixelPlacedEvent:                 true,
	basicPixelPlacedEvent:            true,
	factionPixelsPlacedEvent:         true,
	chainFactionPixelsPlacedEvent:    true,
	extraPixelsPlacedEvent:           true,
	dailyQuestClaimedEvent:           true,
	mainQuestClaimedEvent:            true,
	voteColorEvent:                   true,
	votableColorAddedEvent:           true,
	factionCreatedEvent:              true,
	factionLeaderChangedEvent:        true,
	factionJoinedEvent:               true,
	factionLeftEvent:                 true,
	chainFactionCreatedEvent:         true,
	chainFactionJoinedEvent:          true,
	nftMintedEvent:                   true,
	nftLikedEvent:                    true,
	nftUnlikedEvent:                  true,
	usernameClaimedEvent:             true,
	usernameChangedEvent:             true,
	nftTransferEvent:                 true,
	factionTemplateAddedEvent:        true,
	factionTemplateRemovedEvent:      true,
	chainFactionTemplateAddedEvent:   true,
	chainFactionTemplateRemovedEvent: true,
	hostAwardedPixelsEvent:           true,
	canvasCreatedEvent:               true,
	canvasHostChangedEvent:           true,
	canvasPixelsPerTimeChangedEvent:  true,
	canvasTimerChangedEvent:          true,
	canvasStartTimeChangedEvent:      true,
	canvasEndTimeChangedEvent:        true,
	canvasColorAddedEvent:            true,
	canvasPixelPlacedEvent:           true,
	canvasBasicPixelPlacedEvent:      true,
	canvasExtraPixelsPlacedEvent:     true,
	canvasHostAwardedUserEvent:       true,
	canvasFavoritedEvent:             true,
	canvasUnfavoritedEvent:           true,
	stencilAddedEvent:                true,
	stencilRemovedEvent:              true,
	stencilFavoritedEvent:            true,
	stencilUnfavoritedEvent:          true,
}

const (
	DATA_STATUS_FINALIZED = "DATA_STATUS_FINALIZED"
	DATA_STATUS_ACCEPTED  = "DATA_STATUS_ACCEPTED"
	DATA_STATUS_PENDING   = "DATA_STATUS_PENDING"
)

func consumeIndexerMsg(w http.ResponseWriter, r *http.Request) {
	// Read the raw body
	body, err := io.ReadAll(r.Body)
	fmt.Println("r", r.Body)
	fmt.Println("body", string(body))
	if err != nil {
		PrintIndexerError("consumeIndexerMsg", "error reading request body", err)
		// return
	}

	// Debug: Print the raw incoming webhook payload
	fmt.Println("[DEBUG] Raw webhook payload:", string(body))

	// Patch: Replace '"batch":{}' with '"batch":[]'
	patchedBody := bytes.Replace(body, []byte("\"batch\":{}"), []byte("\"batch\":[]"), 1)

	fmt.Println("body", string(body))
	fmt.Println("patchedBody", string(patchedBody))
	// Restore body for further processing
	r.Body = io.NopCloser(bytes.NewBuffer(patchedBody))

	message, err := routeutils.ReadJsonBody[IndexerMessage](r)
	fmt.Println("message", message)
	if err != nil {
		PrintIndexerError("consumeIndexerMsg", "error reading indexer message", err)
		return
	}

	if len(message.Data.Batch) == 0 {
		fmt.Println("No events in batch")
		// return
	}

	switch message.Data.Finality {
	case DATA_STATUS_FINALIZED:
		// TODO: Track diffs with accepted messages? / check if accepted message processed
		FinalizedMessageLock.Lock()
		FinalizedMessageQueue = append(FinalizedMessageQueue, *message)
		FinalizedMessageLock.Unlock()
		return
	case DATA_STATUS_ACCEPTED:
		AcceptedMessageLock.Lock()
		// TODO: Ensure ordering w/ EndCursor?
		AcceptedMessageQueue = append(AcceptedMessageQueue, *message)
		AcceptedMessageLock.Unlock()
		return
	case DATA_STATUS_PENDING:
		PendingMessageLock.Lock()
		LatestPendingMessage = message
		PendingMessageLock.Unlock()
		return
	}
}

func ProcessMessageEvents(message IndexerMessage) {
	if len(message.Data.Batch) == 0 {
		fmt.Println("No batches in message")
		return
	}
	for _, batch := range message.Data.Batch {
		if len(batch.Events) == 0 {
			fmt.Println("No events in batch")
			continue
		}
		for _, event := range batch.Events {
			if len(event.Event.Keys) == 0 {
				fmt.Println("[WARN] Event with empty Keys array, skipping event:", event)
				continue
			}
			eventKey := event.Event.Keys[0]
			eventProcessor, ok := eventProcessors[eventKey]
			if !ok {
				PrintIndexerError("consumeIndexerMsg", "error processing event", eventKey)
				return
			}
			eventProcessor(event)
		}
	}
}

// TODO: Improve this with hashing?
func EventComparator(event1 IndexerEvent, event2 IndexerEvent) bool {
	if event1.Event.FromAddress != event2.Event.FromAddress {
		return false
	}

	if len(event1.Event.Keys) != len(event2.Event.Keys) {
		return false
	}

	if len(event1.Event.Data) != len(event2.Event.Data) {
		return false
	}

	for idx := 0; idx < len(event1.Event.Keys); idx++ {
		if event1.Event.Keys[idx] != event2.Event.Keys[idx] {
			return false
		}
	}

	for idx := 0; idx < len(event1.Event.Data); idx++ {
		if event1.Event.Data[idx] != event2.Event.Data[idx] {
			return false
		}
	}

	return true
}

func processMessageEventsWithReverter(oldMessage IndexerMessage, newMessage IndexerMessage) {
	var idx int
	var latestEventIndex int
	var unorderedEvents []IndexerEvent
	for idx = 0; idx < len(oldMessage.Data.Batch[0].Events); idx++ {
		oldEvent := oldMessage.Data.Batch[0].Events[idx]
		newEvent := newMessage.Data.Batch[0].Events[idx]
		// Check if events are the same
		if EventComparator(oldEvent, newEvent) {
			latestEventIndex = idx
			continue
		}

		// Non-matching events, revert remaining old events based on ordering
		// TODO: Print note here and see how often this happens
		// Revert events from end of old events to current event
		latestEventIndex = idx
		for idx = len(oldMessage.Data.Batch[0].Events) - 1; idx >= latestEventIndex; idx-- {
			eventKey := oldMessage.Data.Batch[0].Events[idx].Event.Keys[0]
			if eventRequiresOrdering[eventKey] {
				// Revert event
				eventReverter, ok := eventReverters[eventKey]
				if !ok {
					PrintIndexerError("consumeIndexerMsg", "error reverting event", eventKey)
					return
				}
				eventReverter(oldMessage.Data.Batch[0].Events[idx])
			} else {
				unorderedEvents = append(unorderedEvents, oldMessage.Data.Batch[0].Events[idx])
			}
		}
		break
	}

	// Process new events
	for idx = latestEventIndex + 1; idx < len(newMessage.Data.Batch[0].Events); idx++ {
		eventKey := newMessage.Data.Batch[0].Events[idx].Event.Keys[0]

		// Check if event is in unordered events
		var wasProcessed bool
		for idx, unorderedEvent := range unorderedEvents {
			if EventComparator(unorderedEvent, newMessage.Data.Batch[0].Events[idx]) {
				// Remove event from unordered events
				unorderedEvents = append(unorderedEvents[:idx], unorderedEvents[idx+1:]...)
				wasProcessed = true
				break
			}
		}
		if wasProcessed {
			continue
		}

		eventProcessor, ok := eventProcessors[eventKey]
		if !ok {
			PrintIndexerError("consumeIndexerMsg", "error processing event", eventKey)
			return
		}
		eventProcessor(newMessage.Data.Batch[0].Events[idx])
	}

	// Revert remaining unordered events
	for _, unorderedEvent := range unorderedEvents {
		eventKey := unorderedEvent.Event.Keys[0]
		eventReverter, ok := eventReverters[eventKey]
		if !ok {
			PrintIndexerError("consumeIndexerMsg", "error reverting event", eventKey)
			return
		}
		eventReverter(unorderedEvent)
	}
}

func ProcessMessage(message IndexerMessage) {
	// Check if there are pending messages for this start key
	// TODO: OrderKey or UniqueKey or both?
	if LastProcessedPendingMessage != nil && LastProcessedPendingMessage.Data.Cursor.OrderKey == message.Data.Cursor.OrderKey {
		processMessageEventsWithReverter(*LastProcessedPendingMessage, message)
	} else {
		ProcessMessageEvents(message)
	}
}

func TryProcessFinalizedMessages() bool {
	FinalizedMessageLock.Lock()
	var message IndexerMessage
	if len(FinalizedMessageQueue) > 0 {
		message = FinalizedMessageQueue[0]
		FinalizedMessageQueue = FinalizedMessageQueue[1:]
		FinalizedMessageLock.Unlock()
	} else {
		FinalizedMessageLock.Unlock()
		return false
	}

	if message.Data.Cursor.OrderKey <= LastFinalizedCursor {
		// Skip message
		return true
	}

	// Submit to Avail Turbo DA on Finalized messages
	/*
		go func() {
			if err := submitToAvailTurboDA(message); err != nil {
				fmt.Printf("Failed to submit to Avail Turbo DA: %v\n", err)
				// Continue processing even if submission fails
			}
		}()
	*/

	ProcessMessage(message)

	fmt.Println("Processed finalized message:", message.Data.Cursor.OrderKey)
	LastFinalizedCursor = message.Data.Cursor.OrderKey
	return true
}

func TryProcessAcceptedMessages() bool {
	AcceptedMessageLock.Lock()
	var message IndexerMessage
	if len(AcceptedMessageQueue) > 0 {
		message = AcceptedMessageQueue[0]
		AcceptedMessageQueue = AcceptedMessageQueue[1:]
		AcceptedMessageLock.Unlock()
	} else {
		AcceptedMessageLock.Unlock()
		return false
	}

	go func() {
		// if err := submitToAvailTurboDA(message); err != nil {
		// 	fmt.Printf("Failed to submit to Avail Turbo DA: %v\n", err)
		// 	// Continue processing even if submission fails
		// }
	}()

	ProcessMessage(message)

	fmt.Println("Processed accepted message:", message.Data.Cursor.OrderKey)
	LastFinalizedCursor = message.Data.Cursor.OrderKey
	return true
}

func TryProcessPendingMessage() bool {
	PendingMessageLock.Lock()
	defer PendingMessageLock.Unlock()

	if LatestPendingMessage == nil {
		return false
	}

	ProcessMessage(*LatestPendingMessage)
	fmt.Println("Processed pending message:", LatestPendingMessage.Data.Cursor.OrderKey)
	LastProcessedPendingMessage = LatestPendingMessage
	LatestPendingMessage = nil
	return true
}

func StartMessageProcessor() {
	// Goroutine to process pending/accepted messages
	go func() {
		for {
			// Check Finalized messages ( for initial load )
			if TryProcessFinalizedMessages() {
				continue
			}

			// Prioritize accepted messages
			if TryProcessAcceptedMessages() {
				continue
			}

			if TryProcessPendingMessage() {
				continue
			}

			// No messages to process, sleep for 1 second
			// time.Sleep( * time.Second)
		}
	}()
}

// TODO: User might miss some messages between loading canvas and connecting to websocket?
// TODO: Check thread safety of these things
