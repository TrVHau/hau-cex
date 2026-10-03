package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/publisher"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/transport"
	"github.com/redis/go-redis/v9"
)

func main() {

	options, err := redis.ParseURL(os.Getenv("REDIS_URL"))
	if err != nil {
		log.Fatalf("invalid REDIS_URL: %v", err)
	}
	redisClient := redis.NewClient(options)
	pub := publisher.New(redisClient)
	consumer := transport.New(redisClient, pub)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log.Println("Starting matching engine...")

	if err := consumer.Run(ctx); err != nil {
		log.Fatalf("Error running consumer: %v", err)
	}
	log.Println("Shutting down matching engine...")
}
