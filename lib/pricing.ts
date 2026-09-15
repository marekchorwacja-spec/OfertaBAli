export type PricedSelection = {
  price: number | null;
  quantity: number;
};

type OfferPricingInput = {
  basePrice: number;
  excellencePrice: number;
  options: PricedSelection[];
  delivery: PricedSelection[];
  discount1Percent: number;
  discount2Percent: number;
  vatPercent: number;
};

const selectionTotal = (items: PricedSelection[]) => items.reduce(
  (sum, item) => sum + (item.price ?? 0) * item.quantity,
  0,
);

export function calculateOfferPricing(input: OfferPricingInput) {
  const equipmentNet = selectionTotal(input.options);
  const deliveryNet = selectionTotal(input.delivery);
  const yachtPackageNet = input.basePrice + input.excellencePrice;
  const discountableSubtotal = yachtPackageNet + equipmentNet;
  const subtotal = discountableSubtotal + deliveryNet;
  const safeDiscount1 = Math.min(Math.max(input.discount1Percent, 0), 100);
  const safeDiscount2 = Math.min(Math.max(input.discount2Percent, 0), 100);
  const safeVat = Math.min(Math.max(input.vatPercent, 0), 100);
  const discount1Value = yachtPackageNet * safeDiscount1 / 100;
  const discount2Value = equipmentNet * safeDiscount2 / 100;
  const discountValue = discount1Value + discount2Value;
  const yachtPackageNetAfterDiscount = yachtPackageNet - discount1Value;
  const equipmentNetAfterDiscount = equipmentNet - discount2Value;
  const configurationNetAfterDiscount = yachtPackageNetAfterDiscount + equipmentNetAfterDiscount;
  const net = configurationNetAfterDiscount + deliveryNet;
  const vatValue = net * safeVat / 100;
  const gross = net + vatValue;

  return {
    equipmentNet,
    deliveryNet,
    yachtPackageNet,
    discountableSubtotal,
    subtotal,
    discount1Value,
    discount2Value,
    discountValue,
    yachtPackageNetAfterDiscount,
    equipmentNetAfterDiscount,
    configurationNetAfterDiscount,
    net,
    vatValue,
    gross,
  };
}
