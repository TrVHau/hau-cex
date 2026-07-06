package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main(){
	log.Println("Starting matching engine...")

	stop:= make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	<-stop
	log.Println("Shutting down matching engine...")
}