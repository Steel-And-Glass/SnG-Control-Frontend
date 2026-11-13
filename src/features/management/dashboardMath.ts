// Exact decimal arithmetic for m² and COP values that arrive as strings.
// Sums never pass through floating point; rounding happens only for display.

interface Decimal { units: bigint; scale: number }

function pow10(exponent: number): bigint {
  return BigInt("1" + "0".repeat(exponent));
}

function parseDecimal(text: string): Decimal {
  const [whole, fraction = ""] = text.split(".");
  return { units: BigInt(whole + fraction), scale: fraction.length };
}

// Returns null for an empty set so the UI can show "sin datos" instead of 0.
export function sumDecimals(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const parsed = values.map(parseDecimal);
  const scale = Math.max(...parsed.map((item) => item.scale));
  const units = parsed.reduce((total, item) => total + item.units * pow10(scale - item.scale), BigInt(0));
  const digits = units.toString().padStart(scale + 1, "0");
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

// Presentation rounding (half up) with Spanish separators: 1.234.567,89
export function formatDecimal(text: string, digits: number): string {
  const { units, scale } = parseDecimal(text);
  const rounded = scale <= digits
    ? units * pow10(digits - scale)
    : (units + pow10(scale - digits) / BigInt(2)) / pow10(scale - digits);
  const padded = rounded.toString().padStart(digits + 1, "0");
  const whole = padded.slice(0, padded.length - digits).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return digits === 0 ? whole : `${whole},${padded.slice(-digits)}`;
}
