package orderbook

import (
	"container/heap"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
)

// Bid: max-heap (giá cao ưu tiên)
// Ask: min-heap (giá thấp ưu tiên)

type SideBook struct {
	side   Side
	heap   PriceHeap
	levels map[string]*PriceLevel // price.string -> PriceLevel
}

func (sb *SideBook) BestPrice() (fixed.Decimal, bool) {
	level := sb.heap.Top()
	if level == nil {
		return fixed.Zero(), false
	}
	return level.Price, true
}

func (sb *SideBook) GetOrCreateLevel(price fixed.Decimal) *PriceLevel {
	level, ok := sb.levels[price.String()]
	if !ok {
		level = &PriceLevel{Price: price}
		sb.levels[price.String()] = level
		heap.Push(&sb.heap, level)
	}
	return level
}

func (sb *SideBook) RemoveLevelIfEmpty(price fixed.Decimal) {
	level, ok := sb.levels[price.String()]
	if !ok {
		return
	}
	if level.IsEmpty() {
		delete(sb.levels, price.String())
		if index := sb.heap.Find(price); index >= 0 {
			heap.Remove(&sb.heap, index)
		}
	}
}

func (sb *SideBook) AddOrder(order *Order) {
	level := sb.GetOrCreateLevel(order.Price)
	level.Enqueue(order)
}

func (sb *SideBook) RemoveOrder(orderID string, price fixed.Decimal) bool {
	level, ok := sb.levels[price.String()]
	if !ok {
		return false
	}
	order := level.Remove(orderID)
	if order == nil {
		return false
	}
	sb.RemoveLevelIfEmpty(price)
	return true
}

func (sb *SideBook) GetLevels(price string) *PriceLevel {
	return sb.levels[price]
}
