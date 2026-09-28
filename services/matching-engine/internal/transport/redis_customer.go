package transport

import (
	"context"
	"encoding/json"
	"fmt"
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

// XGROUP CREATE stream:engine:commands matching-engine-v1 $ MKSTREAM (idempotent)
// XREADGROUP GROUP matching-engine-v1 engine-1 COUNT 10 BLOCK 200ms STREAMS stream:engine:commands >
// Parse message fields → unmarshal commandSeq, messageType, payload
// dispatch(): route by messageType → HandleOpenMarket / HandlePlaceOrder / HandleCancelOrder
// PublishBatch() events → XACK only after successful publish
// Get-or-create PairEngine by partitionKey (tradingPairId)
func (c *Customer) Run(ctx context.Context) error {
	err := c.redis.XGroupCreateMkStream(ctx, EngineCommandsStream, CommandGroup, "$").Err()

	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("create consumer group: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			// do nothing
		}

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
		if err == redis.Nil {
			continue
		}
		if err != nil {
			return fmt.Errorf("read command stream: %w", err)
		}

		for _, stream := range result {
			for _, msg := range stream.Messages {
				if err := c.dispatch(ctx, msg); err != nil {
					// not ack
					// msg is still in Pending
					fmt.Printf("failed to process msg: %v, err: %v", msg.ID, err)
				}
			}
		}
	}

}

func (c *Customer) dispatch(
	ctx context.Context,
	msg redis.XMessage,
) error {

	// 1. Lấy các field từ Redis message
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

	// 2. Parse command sequence
	var commandSeq uint64

	_, err := fmt.Sscanf(commandSeqStr, "%d", &commandSeq)
	if err != nil {
		return fmt.Errorf(
			"invalid commandSeq %q: %w",
			commandSeqStr,
			err,
		)
	}

	// 3. partitionKey chính là tradingPairId
	pairID := partitionKey

	// 4. Get hoặc create PairEngine
	engine, ok := c.engines[pairID]

	if !ok {
		engine = &pair.PairEngine{
			PairID: pairID,
			State:  pair.StateRecovering,
		}

		c.engines[pairID] = engine
	}

	// 5. Dispatch command
	var events []message.EventEnvelope

	switch messageType {

	case "OpenMarket":

		var command message.OpenMarketCommand

		if err := json.Unmarshal(
			[]byte(payload),
			&command,
		); err != nil {
			return fmt.Errorf(
				"unmarshal OpenMarket: %w",
				err,
			)
		}

		events = engine.HandleOpenMarket(
			command,
			commandSeq,
		)

	case "PlaceOrder":

		var command message.PlaceOrderCommand

		if err := json.Unmarshal(
			[]byte(payload),
			&command,
		); err != nil {
			return fmt.Errorf(
				"unmarshal PlaceOrder: %w",
				err,
			)
		}

		events = engine.HandlePlaceOrder(
			command,
			commandSeq,
		)

	case "CancelOrder":

		var command message.CancelOrderCommand

		if err := json.Unmarshal(
			[]byte(payload),
			&command,
		); err != nil {
			return fmt.Errorf(
				"unmarshal CancelOrder: %w",
				err,
			)
		}

		events = engine.HandleCancelOrder(
			command,
			commandSeq,
		)

	default:
		return fmt.Errorf(
			"unknown message type: %s",
			messageType,
		)
	}

	// 6. Duplicate command
	//
	// PairEngine trả nil khi commandSeq đã được xử lý.
	if len(events) == 0 {
		return c.ack(ctx, msg.ID)
	}

	// 7. Publish events
	//
	// Publish thành công rồi mới ACK.
	if err := c.publisher.PublishBatch(ctx, events); err != nil {
		return fmt.Errorf(
			"publish events: %w",
			err,
		)
	}

	// 8. ACK sau khi publish thành công
	return c.ack(ctx, msg.ID)
}

func (c *Customer) ack(ctx context.Context, msgID string) error {
	return c.redis.XAck(ctx, EngineCommandsStream, CommandGroup, msgID).Err()
}
