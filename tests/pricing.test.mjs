import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../data/models.json" with { type: "json" };
import { calculateOfferPricing } from "../lib/pricing.ts";

test("delivery is never discounted for any BALI price list", () => {
  for (const model of catalog.models) {
    if (!model.versions.length || !model.delivery.length) continue;
    const version = model.versions[0];
    const option = model.options.find((item) => item.price !== null);
    const delivery = model.delivery.find((item) => item.price !== null);
    if (!delivery) continue;

    const result = calculateOfferPricing({
      basePrice: version.basePrice,
      excellencePrice: model.excellencePackage.price,
      options: option ? [{ price: option.price, quantity: 1 }] : [],
      delivery: [{ price: delivery.price, quantity: 1 }],
      discountPercent: 10,
      vatPercent: 23,
    });
    const discountable = version.basePrice + model.excellencePackage.price + (option?.price ?? 0);

    assert.equal(result.discountValue, discountable * 0.1, `${model.name}: incorrect discount base`);
    assert.equal(result.net, discountable * 0.9 + delivery.price, `${model.name}: delivery was discounted`);
    assert.equal(result.deliveryNet, delivery.price, `${model.name}: delivery value changed`);
  }
});

test("discount and VAT inputs are safely bounded", () => {
  const result = calculateOfferPricing({
    basePrice: 100,
    excellencePrice: 0,
    options: [],
    delivery: [{ price: 25, quantity: 1 }],
    discountPercent: 150,
    vatPercent: -10,
  });

  assert.equal(result.discountValue, 100);
  assert.equal(result.net, 25);
  assert.equal(result.gross, 25);
});
