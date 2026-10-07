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

func MustParse(value string) Decimal {
	decimal, err := Parse(value)
	if err != nil {
		panic(err)
	}
	return decimal
}

func (d Decimal) rawValue() *big.Int {
	if d.raw == nil {
		return big.NewInt(0)
	}
	return d.raw
}

func (d Decimal) IsZero() bool {
	return d.rawValue().Sign() == 0
}

// parse tu string "1.5000000000000000"
func Parse(s string) (Decimal, error) {
	negative := strings.HasPrefix(s, "-")
	if negative {
		s = s[1:]
	}

	parts := strings.SplitN(s, ".", 2)
	intPart := new(big.Int)
	if _, ok := intPart.SetString(parts[0], 10); !ok {
		return Zero(), fmt.Errorf("invalid decimal: %s", s)
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

	if negative {
		raw.Neg(raw)
	}
	return Decimal{raw: raw}, nil
}

func (d Decimal) Add(other Decimal) Decimal {
	return Decimal{raw: new(big.Int).Add(d.rawValue(), other.rawValue())}
}

func (d Decimal) Sub(other Decimal) Decimal {
	return Decimal{raw: new(big.Int).Sub(d.rawValue(), other.rawValue())}
}

func (d Decimal) Mul(other Decimal) Decimal {
	result := new(big.Int).Mul(d.rawValue(), other.rawValue())
	result.Div(result, scaleInt)
	return Decimal{raw: result}
}

func (d Decimal) Cmp(other Decimal) int {
	return d.rawValue().Cmp(other.rawValue())
}

func (d Decimal) String() string {
	// convert backto "interger.fraction" string vs 18 decimal places
	raw := d.rawValue()
	abs := new(big.Int).Abs(raw)
	intPart := new(big.Int).Div(abs, scaleInt)
	fracPart := new(big.Int).Mod(abs, scaleInt)
	sign := ""
	if raw.Sign() < 0 {
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
