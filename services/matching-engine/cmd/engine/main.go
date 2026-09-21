package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	
)

func main() {

	redisClient := redis.NewClient(&redis.Options{
		Addr:     os.Getenv("REDIS_URL"),
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	ctx, cancel := signal.NotifyContext(context.Background(),syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log.Println("Starting matching engine...")

	if err:=consumer.Run(ctx);err!=nil{
		log.Fatalf("Error running consumer: %v", err)
	}
	log.Println("Shutting down matching engine...")
}
