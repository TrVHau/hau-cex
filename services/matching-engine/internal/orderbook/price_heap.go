package orderbook

import "github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"

type PriceHeap struct {
	levels []*PriceLevel
	max    bool
}

func (h PriceHeap) Len() int {
	return len(h.levels)
}

func (h PriceHeap) Less(i, j int) bool {
	comparison := h.levels[i].Price.Cmp(h.levels[j].Price)
	if h.max {
		return comparison > 0
	}
	return comparison < 0
}

func (h PriceHeap) Swap(i, j int) {
	h.levels[i], h.levels[j] = h.levels[j], h.levels[i]
}

func (h *PriceHeap) Push(value any) {
	h.levels = append(h.levels, value.(*PriceLevel))
}

func (h *PriceHeap) Pop() any {
	last := len(h.levels) - 1
	level := h.levels[last]
	h.levels = h.levels[:last]
	return level
}

func (h *PriceHeap) Find(price fixed.Decimal) int {
	for index, level := range h.levels {
		if level.Price.Cmp(price) == 0 {
			return index
		}
	}
	return -1
}

func (h *PriceHeap) Top() *PriceLevel {
	if len(h.levels) == 0 {
		return nil
	}
	return h.levels[0]
}
