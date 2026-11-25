import type { BooksState, Product, StockLevel } from '../types';

export function stockQty(
  stock: StockLevel[],
  productId: string,
  locationId?: string,
): number {
  return stock
    .filter(
      (s) =>
        s.productId === productId &&
        (locationId ? s.locationId === locationId : true),
    )
    .reduce((sum, s) => sum + s.qty, 0);
}

export function withProductTotals(products: Product[], stock: StockLevel[]): Product[] {
  return products.map((p) =>
    p.type === 'inventory'
      ? { ...p, qtyOnHand: stockQty(stock, p.id) }
      : { ...p, qtyOnHand: 0 },
  );
}

export function adjustStock(
  stock: StockLevel[],
  locationId: string,
  lines: { productId?: string; qty: number }[],
  direction: 1 | -1,
  inventoryProductIds: Set<string>,
): StockLevel[] {
  let next = [...stock];
  for (const line of lines) {
    if (!line.productId || !inventoryProductIds.has(line.productId) || !line.qty) continue;
    const idx = next.findIndex(
      (s) => s.locationId === locationId && s.productId === line.productId,
    );
    if (idx >= 0) {
      const qty = Math.max(0, next[idx].qty + direction * line.qty);
      next[idx] = { ...next[idx], qty };
    } else if (direction > 0) {
      next.push({ locationId, productId: line.productId, qty: line.qty });
    }
  }
  return next.filter((s) => s.qty > 0 || inventoryProductIds.has(s.productId));
}

export function inventoryMatrix(state: BooksState) {
  const locations = state.locations.filter((l) => l.isActive);
  const products = state.products.filter((p) => p.type === 'inventory');
  return products.map((p) => ({
    product: p,
    byLocation: Object.fromEntries(
      locations.map((l) => [l.id, stockQty(state.stock, p.id, l.id)]),
    ) as Record<string, number>,
    total: stockQty(state.stock, p.id),
  }));
}
