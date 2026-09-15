import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import catalog from "../data/models.json" with { type: "json" };
import { hasConfigurableQuantity } from "../lib/options.ts";
import { calculateOfferPricing } from "../lib/pricing.ts";

const translationsUrl = new URL("../data/translations_a2027.json", import.meta.url);

test("watermaker naming is corrected in every model and translation", async () => {
  const translations = await readFile(translationsUrl, "utf8");
  const descriptions = catalog.models.flatMap((model) => model.options.map((option) => option.description));

  assert.equal(descriptions.some((description) => /odsysacz/i.test(description)), false);
  assert.doesNotMatch(translations, /odsysacz/i);
  assert.ok(descriptions.some((description) => description.includes("Odsalarka wody")));
});

test("fans, electric toilets and saloon table seats accept quantities", () => {
  const quantityOptions = catalog.models.flatMap((model) => model.options.filter(hasConfigurableQuantity));

  assert.ok(quantityOptions.some((option) => /wentylator/i.test(option.description)));
  assert.ok(quantityOptions.some((option) => /toalet/i.test(option.description)));
  assert.ok(quantityOptions.some((option) => /siedzisko.*stołu w salonie/i.test(option.description)));
});

test("a quantity of four multiplies the unit price by four", () => {
  const unitPrice = 240;
  const result = calculateOfferPricing({
    basePrice: 0,
    excellencePrice: 0,
    options: [{ price: unitPrice, quantity: 4 }],
    delivery: [],
    discountPercent: 0,
    vatPercent: 0,
  });

  assert.equal(result.equipmentNet, unitPrice * 4);
  assert.equal(result.net, unitPrice * 4);
});
