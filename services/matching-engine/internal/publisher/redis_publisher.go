package publisher

import (
	"context"
	"encoding/json"

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
	pipe := p.client.Pipeline()
	for _, event := range events {
		payload, _ := json.Marshal(event.Payload)
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
	_, err := pipe.Exec(ctx)
	return err
}
