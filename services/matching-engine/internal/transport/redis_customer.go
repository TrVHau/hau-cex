package transport

import (
	"context"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/pair"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/publisher"
	"github.com/redis/go-redis/v9"
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

func (c *Customer) Run(ctx context.Context) error {
	// 1. XGROUP CREATE stream:engine:commands matching-engine-v1 $ MKSTREAM
	// 2. XREADGROUP loop → parse envelope → dispatch to PairEngine
	// 3. Publish events → XACK
	return nil
}

func (c *Customer) dispatch(ctx context.Context, msg redis.XMessage) {
	// Parse partitionKey as pairId
	// Get or create PairEngine for pairId
	// Parse messageType → route to HandleOpenMarket / HandlePlaceOrder / HandleCancelOrder
	// Publish event batch
	// XACK
}
