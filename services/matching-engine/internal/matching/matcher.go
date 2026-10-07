package matching

import (
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/orderbook"
)

type TradeResult struct {
	MatchIndex                 int
	RestingOrderId             string
	IncomingOrderId            string
	ExecutionPrice             fixed.Decimal // = resting price (maker price)
	ExecutedQuantity           fixed.Decimal
	RestingFull                bool // resting đã fill hết
	RestingRemainingQuantity   fixed.Decimal
	IncomingRemainingQuantity  fixed.Decimal // remaining after this trade
}

type MatchResult struct {
	Trades       []TradeResult
	IncomingFull bool // incoming đã fill hết
}

func Match(book *orderbook.OrderBook, incoming *orderbook.Order) MatchResult {
	var trades []TradeResult
	matchIndex := 0
	isIncomingBuy := incoming.Side == orderbook.Buy

	for !incoming.RemainingQuantity.IsZero() {
		// láy best opposite
		var bestPrice fixed.Decimal
		var hasBest bool
		if isIncomingBuy {
			bestPrice, hasBest = book.Asks.BestPrice()
		} else {
			bestPrice, hasBest = book.Bids.BestPrice()
		}
		if !hasBest {
			break
		}

		// price cross check
		if isIncomingBuy && incoming.Price.Cmp(bestPrice) < 0 {
			break
		}
		if !isIncomingBuy && incoming.Price.Cmp(bestPrice) > 0 {
			break
		}

		// lấy resting order FIFO
		var level *orderbook.PriceLevel
		if isIncomingBuy {
			level = book.Asks.Levels()[bestPrice.String()]
		} else {
			level = book.Bids.Levels()[bestPrice.String()]
		}
		if level == nil {
			break
		}
		resting := level.Front()

		executedQuantity := fixed.Min(incoming.RemainingQuantity, resting.RemainingQuantity)
		executionPrice := resting.Price //maker price

		// update quantities
		incoming.RemainingQuantity = incoming.RemainingQuantity.Sub(executedQuantity)
		resting.RemainingQuantity = resting.RemainingQuantity.Sub(executedQuantity)
		level.PartialFill(executedQuantity) // always decrement level total

		restingFull := resting.RemainingQuantity.IsZero()
		if restingFull {
			level.Dequeue()
			delete(book.ActiveOrders, resting.OrderID)
			if level.IsEmpty() {
				if isIncomingBuy {
					book.Asks.RemoveLevelIfEmpty(bestPrice)
				} else {
					book.Bids.RemoveLevelIfEmpty(bestPrice)
				}
			}
		}

		trades = append(trades, TradeResult{
			MatchIndex:                matchIndex,
			RestingOrderId:            resting.OrderID,
			IncomingOrderId:           incoming.OrderID,
			ExecutionPrice:            executionPrice,
			ExecutedQuantity:          executedQuantity,
			RestingFull:               restingFull,
			RestingRemainingQuantity:  resting.RemainingQuantity,
			IncomingRemainingQuantity: incoming.RemainingQuantity,
		})
		matchIndex++
	}

	// nếu incoming còn quantity thì add vào book
	if !incoming.RemainingQuantity.IsZero() {
		book.AddOrder(incoming)
	}
	return MatchResult{
		Trades:       trades,
		IncomingFull: incoming.RemainingQuantity.IsZero(),
	}
}
