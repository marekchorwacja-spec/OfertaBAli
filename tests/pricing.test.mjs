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
      discount1Percent: 10,
      discount2Percent: 20,
      vatPercent: 23,
    });
    const yachtAndPackage = version.basePrice + model.excellencePackage.price;
    const equipment = option?.price ?? 0;

    assert.equal(result.discount1Value, yachtAndPackage * 0.1, `${model.name}: incorrect yacht/package discount`);
    assert.equal(result.discount2Value, equipment * 0.2, `${model.name}: incorrect equipment discount`);
    assert.equal(result.net, yachtAndPackage * 0.9 + equipment * 0.8 + delivery.price, `${model.name}: delivery was discounted`);
    assert.equal(result.deliveryNet, delivery.price, `${model.name}: delivery value changed`);
  }
});

test("discount and VAT inputs are safely bounded", () => {
  const result = calculateOfferPricing({
    basePrice: 100,
    excellencePrice: 0,
    options: [],
    delivery: [{ price: 25, quantity: 1 }],
    discount1Percent: 150,
    discount2Percent: -15,
    vatPercent: -10,
  });

  assert.equal(result.discountValue, 100);
  assert.equal(result.net, 25);
  assert.equal(result.gross, 25);
});
