import Decimal from 'decimal.js'

// Mirror Python's default decimal context, which the ported engine was written
// against: 28 significant digits, HALF_EVEN for intermediate arithmetic.
// Rounding money to 2dp always passes ROUND_HALF_UP explicitly, exactly as the
// Python code passes it to quantize().
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN })

export const CENT = new Decimal('0.01')

export const to2dp = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

export { Decimal }
