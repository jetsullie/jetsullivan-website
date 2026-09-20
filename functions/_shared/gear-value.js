// Values are stored in USD; calculate totals in cents to avoid rounding drift.
export const parseEstimatedValue = (input) => {
  const text = String(input ?? '').trim();
  if (!text) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || Number(text) > 999999999.99) {
    throw new Error('Estimated value must be a non-negative USD amount with at most two decimal places (maximum 999,999,999.99).');
  }
  return Number(text);
};

export const storedEstimatedValue = (item) => {
  try { return parseEstimatedValue(item.estimatedValue); } catch { return null; }
};

export const gearValueSummary = (items) => {
  let cents = 0;
  let valuedItemCount = 0;
  for (const item of items) {
    const value = storedEstimatedValue(item);
    if (value === null) continue;
    cents += Math.round(value * 100);
    valuedItemCount++;
  }
  return { totalValue: cents / 100, valuedItemCount, itemCount: items.length, currency: 'USD' };
};
