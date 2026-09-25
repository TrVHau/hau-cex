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

	redisClient := redis.NewClient(&redis.Options{
		Addr: os.Getenv("REDIS_URL"),
	})
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
