package message

import "time"

type MessageEnvelope struct {
	MessageID       string    `json:"messageId"`
	MessageType     string    `json:"messageType"`
	Version         int       `json:"version"`
	CorrelationID   string    `json:"correlationId"`
	OccurredAt      time.Time `json:"occurredAt"`
	PartitionKey    string    `json:"partitionKey"`
	CommandSequence string    `json:"commandSequence,omitempty"`
	Payload         any       `json:"payload"`
}
