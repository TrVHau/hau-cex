package transport

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/message"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/pair"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/publisher"
	"github.com/redis/go-redis/v9"
)

const (
	EngineCommandsStream = "stream:engine:commands"
	CommandGroup         = "matching-engine-v1"
	CustomerName         = "engine-1"
)

type Customer struct {
	redis     *redis.Client
	publisher *publisher.Publisher
	engines   map[string]*pair.PairEngine // pairId -> engine
}

func New(redisClient *redis.Client, pub *publisher.Publisher) *Customer {
	return &Customer{
		redis:     redisClient,
		publisher: pub,
		engines:   make(map[string]*pair.PairEngine),
	}
}

// Run consumes engine commands from Redis Streams, dispatches to PairEngine,
// publishes events, then ACKs. Blocks until ctx is cancelled.
func (c *Customer) Run(ctx context.Context) error {
	err := c.redis.XGroupCreateMkStream(ctx, EngineCommandsStream, CommandGroup, "$").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("create consumer group: %w", err)
	}

	for {
		result, err := c.redis.XReadGroup(
			ctx,
			&redis.XReadGroupArgs{
				Group:    CommandGroup,
				Consumer: CustomerName,
				Streams:  []string{EngineCommandsStream, ">"},
				Count:    10,
				Block:    200 * time.Millisecond,
			},
		).Result()

		if err != nil {
			// Context cancelled — clean exit
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return nil
			}
			// No new messages — continue polling
			if errors.Is(err, redis.Nil) {
				continue
			}
			return fmt.Errorf("read command stream: %w", err)
		}

		for _, stream := range result {
			for _, msg := range stream.Messages {
				if err := c.dispatch(ctx, msg); err != nil {
					// Message stays in PEL; log and continue — do NOT ACK
					log.Printf("failed to process msg %s: %v", msg.ID, err)
				}
			}
		}
	}
}

func (c *Customer) dispatch(
	ctx context.Context,
	msg redis.XMessage,
) error {

	// 1. Extract fields from Redis message
	messageType, ok := msg.Values["messageType"].(string)
	if !ok {
		return fmt.Errorf("invalid messageType")
	}

	partitionKey, ok := msg.Values["partitionKey"].(string)
	if !ok {
		return fmt.Errorf("invalid partitionKey")
	}

	commandSeqStr, ok := msg.Values["commandSeq"].(string)
	if !ok {
		return fmt.Errorf("invalid commandSeq")
	}

	payload, ok := msg.Values["payload"].(string)
	if !ok {
		return fmt.Errorf("invalid payload")
	}

	// 2. Parse command sequence — strconv is faster and idiomatic vs fmt.Sscanf
	commandSeq, err := strconv.ParseUint(commandSeqStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid commandSeq %q: %w", commandSeqStr, err)
	}

	// 3. partitionKey is the tradingPairId
	pairID := partitionKey

	// 4. Get or create PairEngine for this pair
	engine, ok := c.engines[pairID]
	if !ok {
		engine = &pair.PairEngine{
			PairID: pairID,
			State:  pair.StateRecovering,
		}
		c.engines[pairID] = engine
	}

	// 5. Dispatch to the correct handler
	var events []message.EventEnvelope

	switch messageType {
	case "OpenMarket":
		var command message.OpenMarketCommand
		if err := json.Unmarshal([]byte(payload), &command); err != nil {
			return fmt.Errorf("unmarshal OpenMarket: %w", err)
		}
		events = engine.HandleOpenMarket(command, commandSeq)

	case "PlaceOrder":
		var command message.PlaceOrderCommand
		if err := json.Unmarshal([]byte(payload), &command); err != nil {
			return fmt.Errorf("unmarshal PlaceOrder: %w", err)
		}
		events = engine.HandlePlaceOrder(command, commandSeq)

	case "CancelOrder":
		var command message.CancelOrderCommand
		if err := json.Unmarshal([]byte(payload), &command); err != nil {
			return fmt.Errorf("unmarshal CancelOrder: %w", err)
		}
		events = engine.HandleCancelOrder(command, commandSeq)

	default:
		return fmt.Errorf("unknown message type: %s", messageType)
	}

	// 6. Nil return from handler means duplicate commandSeq — ACK and move on
	if len(events) == 0 {
		return c.ack(ctx, msg.ID)
	}

	// 7. Publish events — ACK only after successful publish
	if err := c.publisher.PublishBatch(ctx, events); err != nil {
		return fmt.Errorf("publish events: %w", err)
	}

	// 8. ACK after successful publish
	return c.ack(ctx, msg.ID)
}

func (c *Customer) ack(ctx context.Context, msgID string) error {
	return c.redis.XAck(ctx, EngineCommandsStream, CommandGroup, msgID).Err()
}
