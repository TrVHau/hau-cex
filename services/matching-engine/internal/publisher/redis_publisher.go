package publisher

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/message"
	"github.com/redis/go-redis/v9"
)

// stream:engine:events
const (
	EngineEventsStream = "stream:engine:events"
)

type Publisher struct {
	client *redis.Client
}

func New(client *redis.Client) *Publisher {
	return &Publisher{client: client}
}

func (p *Publisher) PublishBatch(ctx context.Context, events []message.EventEnvelope) error {
	if len(events) == 0 {
		return nil
	}
	pipe := p.client.Pipeline()
	for _, event := range events {
		payload, err := json.Marshal(event.Payload)
		if err != nil {
			return fmt.Errorf("marshal payload for %s: %w", event.MessageType, err)
		}
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: EngineEventsStream,
			Values: map[string]any{
				"messageId":    event.MessageID,
				"messageType":  event.MessageType,
				"partitionKey": event.PartitionKey,
				"commandSeq":   event.CommandSequence,
				"payload":      string(payload),
			},
		})
	}
	cmds, err := pipe.Exec(ctx)
	if err != nil {
		// Check per-command errors to surface partial failures
		for _, cmd := range cmds {
			if cmdErr := cmd.Err(); cmdErr != nil && cmdErr != redis.Nil {
				return fmt.Errorf("pipeline xadd failed: %w", cmdErr)
			}
		}
		return fmt.Errorf("pipeline exec: %w", err)
	}
	return nil
}
