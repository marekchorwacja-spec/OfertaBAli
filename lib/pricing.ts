export type PricedSelection = {
  price: number | null;
  quantity: number;
};

type OfferPricingInput = {
  basePrice: number;
  excellencePrice: number;
  options: PricedSelection[];
  delivery: PricedSelection[];
  discountPercent: number;
  vatPercent: number;
};

const selectionTotal = (items: PricedSelection[]) => items.reduce(
  (sum, item) => sum + (item.price ?? 0) * item.quantity,
  0,
);

export function calculateOfferPricing(input: OfferPricingInput) {
  const equipmentNet = selectionTotal(input.options);
  const deliveryNet = selectionTotal(input.delivery);
  const discountableSubtotal = input.basePrice + input.excellencePrice + equipmentNet;
  const subtotal = discountableSubtotal + deliveryNet;
  const safeDiscount = Math.min(Math.max(input.discountPercent, 0), 100);
  const safeVat = Math.min(Math.max(input.vatPercent, 0), 100);
  const discountValue = discountableSubtotal * safeDiscount / 100;
  const configurationNetAfterDiscount = discountableSubtotal - discountValue;
  const net = configurationNetAfterDiscount + deliveryNet;
  const vatValue = net * safeVat / 100;
  const gross = net + vatValue;

  return {
    equipmentNet,
    deliveryNet,
    discountableSubtotal,
    subtotal,
    discountValue,
    configurationNetAfterDiscount,
    net,
    vatValue,
    gross,
  };
}
