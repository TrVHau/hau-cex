package pair

import (
	"errors"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/message"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/orderbook"
)

type EngineState string

const (
	StateRecovering EngineState = "RECOVERING"
	StateReady      EngineState = "READY"
	StateSuspended  EngineState = "SUSPENDED"
	StateFailed     EngineState = "FAILED"
)

var (
	ErrDuplicateCommand = errors.New("duplicate command sequence")
	ErrSequenceGap      = errors.New("command sequence gap")
)

type PairEngine struct {
	PairID              string
	Market              string
	State               EngineState
	Book                *orderbook.OrderBook
	LastProcessedCmdSeq uint64
	LastTradeSequence   uint64
	LastBookSequence    uint64
	InFlight            *InFlightBatch
}

type InFlightBatch struct {
	CommandSequence uint64
	Events          []message.EventEnvelope
	Published       bool
}

func (e *PairEngine) HandleOpenMarket(cmd message.OpenMarketCommand, cmdSeq uint64) []message.MessageEnvelope {
	// kierm tra validateSeq(cmdSeg) -> chuyern sang stateReady -> trả về marketopened event

}
func (e *PairEngine) HandlePlaceOrder(cmd message.PlaceOrderCommand, cmdSeq uint64) []message.MessageEnvelope{
	if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
		return nil // skip duplicate command
	} else if err == ErrSequenceGap {
		e.State = StateSuspended
		return []message.EventEnvelope{buil}
}
func (e *PairEngine) HandleCancelOrder(cmd message.CancelOrderCommand, cmdSeq uint64) []message.MessageEnvelope

// Sequence validation
func (e *PairEngine) validateSeq(cmdSeq uint64) error {
	expected := e.LastProcessedCmdSeq + 1
	if cmdSeq < expected {
		return ErrDuplicateCommand // đã xử lý, skip
	}
	if cmdSeq > expected {
		return ErrSequenceGap // block Pair
	}
	return nil
}
