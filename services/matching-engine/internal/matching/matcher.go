package matching

import (
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/orderbook"
)

type TradeResult struct {
	MatchIndex       int
	RestingOrderId   string
	IncomingOrderId  string
	ExecutionPrice   fixed.Decimal // = resting price
	ExecutedQuantity fixed.Decimal
	RestingFull      bool // resting đã fill hết
}

type MatchResult struct {
	Trades       []TradeResult
	IncomingFull bool // incoming đã fill hết
}

func Match(book *orderbook.OrderBook, incoming *orderbook.Order, cmdSeq uint64) MatchResult {
	var trades []TradeResult
	matchIndex := 0

	for !incoming.RemainingQuantity.IsZero() {
		// láy best opposite
		var bestPrice fixed.Decimal
		var hasBest bool
		if incoming.Side == orderbook.Buy {
			bestPrice, hasBest = book.Asks.BestPrice()
		} else {
			bestPrice, hasBest = book.Bids.BestPrice()
		}
		if !hasBest {
			break
		}

		// price cross check
		if incoming.Side == orderbook.Buy && incoming.Price.Cmp(bestPrice) < 0 {
			break
		}
		if incoming.Side == orderbook.Sell && incoming.Price.Cmp(bestPrice) > 0 {
			break
		}

		// lấy resting order FIFO
		var level *orderbook.PriceLevel
		if incoming.Side == orderbook.Buy {
			level = book.Asks.GetLevels(bestPrice.String())
		} else {
			level = book.Bids.GetLevels(bestPrice.String())
		}
		resting := level.Front()

		executedQuantity := fixed.Min(incoming.RemainingQuantity, resting.RemainingQuantity)
		executionPrice := resting.Price //maker price

		// update quantities
		incoming.RemainingQuantity = incoming.RemainingQuantity.Sub(executedQuantity)
		resting.RemainingQuantity = resting.RemainingQuantity.Sub(executedQuantity)
		level.TotalQuantity = level.TotalQuantity.Sub(executedQuantity)

		restingFull := resting.RemainingQuantity.IsZero()
		if restingFull {
			level.Dequeue()
			book.ActiveOrders[resting.OrderID] = nil
			delete(book.ActiveOrders, resting.OrderID)
			if level.IsEmpty() {
				if incoming.Side == orderbook.Buy {
					book.Asks.RemoveLevelIfEmpty(bestPrice)
				} else {
					book.Bids.RemoveLevelIfEmpty(bestPrice)
				}
			}
		}

		trades = append(trades, TradeResult{
			MatchIndex:       matchIndex,
			RestingOrderId:   resting.OrderID,
			IncomingOrderId:  incoming.OrderID,
			ExecutionPrice:   executionPrice,
			ExecutedQuantity: executedQuantity,
			RestingFull:      restingFull,
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
