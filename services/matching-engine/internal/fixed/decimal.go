package fixed

import (
	"fmt"
	"math/big"
	"strings"
)

const Scale = 18

var scaleInt = new(big.Int).Exp(big.NewInt(10), big.NewInt(Scale), nil)

// decimal là fixed point integer: value = raw /10^18
type Decimal struct {
	raw *big.Int
}

func Zero() Decimal {
	return Decimal{raw: big.NewInt(0)}
}

func (d Decimal) IsZero() bool {
	return d.raw.Sign() == 0
}

// parse tu string "1.5000000000000000"
func Parse(s string) (Decimal, error) {
	parts := strings.SplitN(s, ".", 2)
	intPart := new(big.Int)
	if _, ok := intPart.SetString(parts[0], 10); !ok {
		return Zero(), fmt.Errorf("invalid decima: %s", s)
	}

	raw := new(big.Int).Mul(intPart, scaleInt)
	if len(parts) == 2 {
		frac := parts[1]
		if len(frac) > Scale {
			frac = frac[:Scale]
		} else {
			frac = frac + strings.Repeat("0", Scale-len(frac))
		}
		fracInt := new(big.Int)
		if _, ok := fracInt.SetString(frac, 10); !ok {
			return Zero(), fmt.Errorf("invalid decimal fraction: %s", s)
		}
		raw.Add(raw, fracInt)
	}
	return Decimal{raw: raw}, nil
}

func (d Decimal) Add(other Decimal) Decimal {
	return Decimal{raw: new(big.Int).Add(d.raw, other.raw)}
}

func (d Decimal) Sub(other Decimal) Decimal {
	return Decimal{raw: new(big.Int).Sub(d.raw, other.raw)}
}

func (d Decimal) Cmp(other Decimal) int {
	return d.raw.Cmp(other.raw)
}

func (d Decimal) String() string {
	// convert backto "interger.fraction" string vs 18 decimal places
	abs := new(big.Int).Abs(d.raw)
	intPart := new(big.Int).Div(abs, scaleInt)
	fracPart := new(big.Int).Mod(abs, scaleInt)
	sign := ""
	if d.raw.Sign() < 0 {
		sign = "-"
	}
	return fmt.Sprintf("%s%s.%018d", sign, intPart.String(), fracPart)
}

func Min(a, b Decimal) Decimal {
	if a.Cmp(b) < 0 {
		return a
	}
	return b
}
