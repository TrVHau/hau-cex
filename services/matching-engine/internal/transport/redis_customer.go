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
	err := c.redis.XGroupCreateMkStream(ctx, EngineCommandsStream, CommandGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("create consumer group: %w", err)
	}

	// Phase 0: Replay all existing stream commands to recover in-memory books and sequence state
	if err := c.recoverHistory(ctx); err != nil {
		return err
	}

	// Phase 1: recover pending (PEL) messages from previous run before reading new ones
	if err := c.drainPending(ctx); err != nil {
		return err
	}

	// Phase 2: consume new messages
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

// drainPending reprocesses any messages that are in the PEL (pending entry list)
// from a previous consumer run. Reads with ID "0" until no more pending msgs.
func (c *Customer) drainPending(ctx context.Context) error {
	for {
		result, err := c.redis.XReadGroup(
			ctx,
			&redis.XReadGroupArgs{
				Group:    CommandGroup,
				Consumer: CustomerName,
				Streams:  []string{EngineCommandsStream, "0"},
				Count:    10,
				Block:    0, // non-blocking
			},
		).Result()

		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return nil
			}
			if errors.Is(err, redis.Nil) {
				return nil // no pending messages
			}
			return fmt.Errorf("drain pending: %w", err)
		}

		if len(result) == 0 || len(result[0].Messages) == 0 {
			return nil // drained
		}

		for _, stream := range result {
			for _, msg := range stream.Messages {
				if err := c.dispatch(ctx, msg); err != nil {
					log.Printf("failed to process pending msg %s: %v", msg.ID, err)
				}
			}
		}
	}
}

// recoverHistory replays all historical messages from stream:engine:commands using XRANGE
// to reconstruct the in-memory order books and sequence counters without re-publishing events.
func (c *Customer) recoverHistory(ctx context.Context) error {
	msgs, err := c.redis.XRange(ctx, EngineCommandsStream, "-", "+").Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil
		}
		return fmt.Errorf("recover history: %w", err)
	}

	if len(msgs) == 0 {
		return nil
	}

	log.Printf("Replaying %d historical engine commands to recover in-memory state...", len(msgs))
	for _, msg := range msgs {
		if _, err := c.executeCommand(msg); err != nil {
			log.Printf("warning: error during history replay for msg %s: %v", msg.ID, err)
		}
	}

	// Ensure all engines are in StateReady and sync orderbook snapshot
	for _, engine := range c.engines {
		engine.State = pair.StateReady
		event := pair.BuildOrderBookChanged(engine, engine.LastProcessedCmdSeq)
		if err := c.publisher.PublishBatch(ctx, []message.EventEnvelope{event}); err != nil {
			log.Printf("warning: publish recovered orderbook snapshot failed: %v", err)
		}
	}

	// Advance consumer group to last replayed message ID so XReadGroup > only reads new commands
	lastMsgID := msgs[len(msgs)-1].ID
	if err := c.redis.XGroupSetID(ctx, EngineCommandsStream, CommandGroup, lastMsgID).Err(); err != nil {
		log.Printf("warning: XGroupSetID failed: %v", err)
	}

	log.Printf("Engine recovery complete. Active pairs: %d. Consumer group set to %s", len(c.engines), lastMsgID)
	return nil
}

func (c *Customer) executeCommand(msg redis.XMessage) ([]message.EventEnvelope, error) {
	// 1. Extract fields from Redis message
	messageType, ok := msg.Values["messageType"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid messageType")
	}

	partitionKey, ok := msg.Values["partitionKey"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid partitionKey")
	}

	commandSeqStr, ok := msg.Values["commandSeq"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid commandSeq")
	}

	payload, ok := msg.Values["payload"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid payload")
	}

	// 2. Parse command sequence
	commandSeq, err := strconv.ParseUint(commandSeqStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid commandSeq %q: %w", commandSeqStr, err)
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
			return nil, fmt.Errorf("unmarshal OpenMarket: %w", err)
		}
		events = engine.HandleOpenMarket(command, commandSeq)

	case "PlaceOrder":
		var command message.PlaceOrderCommand
		if err := json.Unmarshal([]byte(payload), &command); err != nil {
			return nil, fmt.Errorf("unmarshal PlaceOrder: %w", err)
		}
		events = engine.HandlePlaceOrder(command, commandSeq)

	case "CancelOrder":
		var command message.CancelOrderCommand
		if err := json.Unmarshal([]byte(payload), &command); err != nil {
			return nil, fmt.Errorf("unmarshal CancelOrder: %w", err)
		}
		events = engine.HandleCancelOrder(command, commandSeq)

	case "SuspendMarket":
		var command message.SuspendMarketCommand
		if err := json.Unmarshal([]byte(payload), &command); err != nil {
			return nil, fmt.Errorf("unmarshal SuspendMarket: %w", err)
		}
		events = engine.HandleSuspendMarket(command, commandSeq)

	default:
		return nil, fmt.Errorf("unknown message type: %s", messageType)
	}

	return events, nil
}

func (c *Customer) dispatch(
	ctx context.Context,
	msg redis.XMessage,
) error {
	events, err := c.executeCommand(msg)
	if err != nil {
		return err
	}

	// Nil return from handler means duplicate commandSeq — ACK and move on
	if len(events) == 0 {
		return c.ack(ctx, msg.ID)
	}

	// Publish events — ACK only after successful publish
	if err := c.publisher.PublishBatch(ctx, events); err != nil {
		return fmt.Errorf("publish events: %w", err)
	}

	// ACK after successful publish
	return c.ack(ctx, msg.ID)
}

func (c *Customer) ack(ctx context.Context, msgID string) error {
	return c.redis.XAck(ctx, EngineCommandsStream, CommandGroup, msgID).Err()
}
