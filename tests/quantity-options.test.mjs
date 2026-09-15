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

  assert.equal(descriptions.some((description) => /odsysacz|zasobnik/i.test(description)), false);
  assert.doesNotMatch(translations, /odsysacz|zasobnik/i);
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
    discount1Percent: 0,
    discount2Percent: 0,
    vatPercent: 0,
  });

  assert.equal(result.equipmentNet, unitPrice * 4);
  assert.equal(result.net, unitPrice * 4);
});

test("BALI 5.2 forepeak options use the approved Polish descriptions", () => {
  const bali52 = catalog.models.find((model) => model.id === "bali-5-2");
  const descriptionsById = Object.fromEntries(bali52.options.map((option) => [option.id, option.description]));

  assert.equal(descriptionsById["bali-5-2-121"], "Wyposażona dziobowa kabina techniczna (forpik) po prawej burcie (materac, prysznic, toaleta elektryczna, luk i roleta zaciemniająca)");
  assert.equal(descriptionsById["bali-5-2-122"], "Wyposażona dziobowa kabina techniczna (forpik) po prawej burcie (materac, luk i roleta zaciemniająca)");
  assert.equal(descriptionsById["bali-5-2-123"], "Wyposażona dziobowa kabina techniczna (forpik) po lewej burcie (materac, prysznic, luk, toaleta elektryczna i roleta zaciemniająca)");
});
