import { todayISO, uid } from './format';
import type {
  BooksState,
  Product,
  StockLevel,
  StockMovement,
  StockMovementReason,
} from '../types';

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

export function canFulfill(
  stock: StockLevel[],
  locationId: string,
  lines: { productId?: string; qty: number }[],
  inventoryProductIds: Set<string>,
): { ok: boolean; shortages: Array<{ productId: string; need: number; have: number }> } {
  const shortages: Array<{ productId: string; need: number; have: number }> = [];
  for (const line of lines) {
    if (!line.productId || !inventoryProductIds.has(line.productId) || !line.qty) continue;
    const have = stockQty(stock, line.productId, locationId);
    if (have < line.qty) {
      shortages.push({ productId: line.productId, need: line.qty, have });
    }
  }
  return { ok: shortages.length === 0, shortages };
}

export function buildMovements(
  locationId: string,
  lines: { productId?: string; qty: number }[],
  direction: 1 | -1,
  inventoryProductIds: Set<string>,
  reason: StockMovementReason,
  ref?: { refType?: string; refId?: string; memo?: string; date?: string },
): StockMovement[] {
  const date = ref?.date ?? todayISO();
  const out: StockMovement[] = [];
  for (const line of lines) {
    if (!line.productId || !inventoryProductIds.has(line.productId) || !line.qty) continue;
    out.push({
      id: uid('mv'),
      date,
      productId: line.productId,
      locationId,
      qtyDelta: direction * line.qty,
      reason,
      refType: ref?.refType,
      refId: ref?.refId,
      memo: ref?.memo ?? '',
      createdAt: todayISO(),
    });
  }
  return out;
}

export function inventoryMatrix(state: BooksState) {
  const locations = state.locations.filter((l) => l.isActive);
  const products = state.products.filter((p) => p.type === 'inventory' && p.isActive !== false);
  return products.map((p) => ({
    product: p,
    byLocation: Object.fromEntries(
      locations.map((l) => [l.id, stockQty(state.stock, p.id, l.id)]),
    ) as Record<string, number>,
    total: stockQty(state.stock, p.id),
  }));
}
