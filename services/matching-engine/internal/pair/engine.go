package pair

import (
	"errors"
	"fmt"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/matching"
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

func (e *PairEngine) HandleOpenMarket(cmd message.OpenMarketCommand, cmdSeq uint64) []message.EventEnvelope {
	if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
		return nil
	} else if err == ErrSequenceGap {
		e.State = StateFailed
		return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP", "Expected command sequence gap")}
	}

	if e.Book == nil {
		e.Book = orderbook.NewOrderBook()
	}
	e.Market = cmd.Market
	e.State = StateReady
	e.LastProcessedCmdSeq = cmdSeq

	return []message.EventEnvelope{buildMarketOpened(e, cmdSeq)}
}

func (e *PairEngine) HandlePlaceOrder(cmd message.PlaceOrderCommand, cmdSeq uint64) []message.EventEnvelope {
	if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
		return nil
	} else if err == ErrSequenceGap {
		e.State = StateFailed
		return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP", fmt.Sprintf("Expected %d got %d", e.LastProcessedCmdSeq+1, cmdSeq))}
	}

	if e.State != StateReady {
		return []message.EventEnvelope{buildOrderRejected(e, cmd, cmdSeq, "MARKET_NOT_READY")}
	}

	incoming := &orderbook.Order{
		OrderID:           cmd.OrderID,
		UserID:            cmd.UserID,
		Side:              cmd.Side,
		Price:             cmd.Price,
		OriginalQuantity:  cmd.Quantity,
		RemainingQuantity: cmd.Quantity,
		OrderSeq:          cmd.OrderSequence,
	}

	result := matching.Match(e.Book, incoming)
	events := make([]message.EventEnvelope, 0)

	for _, trade := range result.Trades {
		e.LastTradeSequence++
		engineMatchID := fmt.Sprintf("%s:%d:%d", e.PairID, cmdSeq, trade.MatchIndex)
		events = append(events, buildTradeCreated(e, cmd, trade, engineMatchID, cmdSeq))
	}

	// Only emit OrderOpened if incoming was NOT fully filled
	if !result.IncomingFull {
		events = append(events, buildOrderOpened(e, cmd, cmdSeq, incoming.RemainingQuantity))
	}

	e.LastBookSequence++
	events = append(events, buildOrderBookChanged(e, cmdSeq))
	e.LastProcessedCmdSeq = cmdSeq
	e.storeInFlight(cmdSeq, events)

	return events
}

func (e *PairEngine) HandleCancelOrder(cmd message.CancelOrderCommand, cmdSeq uint64) []message.EventEnvelope {
	if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
		return nil
	} else if err == ErrSequenceGap {
		e.State = StateFailed
		return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP", fmt.Sprintf("Expected %d got %d", e.LastProcessedCmdSeq+1, cmdSeq))}
	}

	if e.State != StateReady {
		return []message.EventEnvelope{buildCancelOrderRejected(e, cmd, cmdSeq, "MARKET_NOT_READY")}
	}

	order, ok := e.Book.ActiveOrders[cmd.OrderID]
	if !ok {
		return []message.EventEnvelope{buildCancelOrderRejected(e, cmd, cmdSeq, "ORDER_NOT_FOUND")}
	}

	cancelledQty := order.RemainingQuantity
	e.Book.RemoveOrder(cmd.OrderID)
	e.LastBookSequence++
	e.LastProcessedCmdSeq = cmdSeq

	events := []message.EventEnvelope{
		buildOrderCancelled(e, cmd, cmdSeq, cancelledQty),
		buildOrderBookChanged(e, cmdSeq),
	}
	e.storeInFlight(cmdSeq, events)

	return events
}

func (e *PairEngine) storeInFlight(cmdSeq uint64, events []message.EventEnvelope) {
	e.InFlight = &InFlightBatch{
		CommandSequence: cmdSeq,
		Events:          events,
	}
}

func (e *PairEngine) MarkInFlightPublished() {
	if e.InFlight != nil {
		e.InFlight.Published = true
	}
}

// validateSeq returns nil if cmdSeq is next expected, ErrDuplicateCommand if already
// processed, ErrSequenceGap if a gap is detected.
func (e *PairEngine) validateSeq(cmdSeq uint64) error {
	expected := e.LastProcessedCmdSeq + 1
	if cmdSeq < expected {
		return ErrDuplicateCommand
	}
	if cmdSeq > expected {
		return ErrSequenceGap
	}
	return nil
}
