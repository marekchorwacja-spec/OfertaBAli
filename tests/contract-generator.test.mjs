import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildContractPdfDefinition, contractNumberForOffer, createContractDraft } from "../lib/contract.ts";

const offer = {
  offerNumber: "OYC/2026/753036",
  contractNumber: "OYC/US/2026/753036",
  offerDate: "15.09.2026",
  model: "BALI 5.8",
  version: "4 kabiny",
  engines: "2 × 115 KM",
  customerName: "Jan Kowalski",
  customerCompany: "",
  customerEmail: "jan@example.com",
  customerPhone: "+48 000 000 000",
  yachtName: "",
  basePrice: 1_700_000,
  excellenceName: "Pakiet Excellence",
  excellencePrice: 200_000,
  options: [{ description: "Wentylator w kabinie", price: 1_000, quantity: 4, category: "Komfort" }],
  yachtNet: 1_990_660,
  deliveryNet: 24_570,
  totalNet: 2_015_230,
};

test("contract derives its number from the accepted offer", () => {
  assert.equal(contractNumberForOffer("OYC/2026/753036"), "OYC/US/2026/753036");
});

test("contract remains net-only and does not apply a fixed VAT rate", () => {
  const definition = buildContractPdfDefinition(offer, createContractDraft(), "data:image/png;base64,AAAA");
  const text = JSON.stringify(definition);
  assert.match(text, /2[^\d]?015[^\d]?230 EUR/);
  assert.match(text, /nie ustala automatycznie stawki VAT 0%, 23% ani 25%/);
  assert.match(text, /Wentylator w kabinie × 4/);
  assert.match(text, /data:image\/png;base64,AAAA/);
});

test("B2C and B2B drafts produce different buyer clauses", () => {
  const b2c = JSON.stringify(buildContractPdfDefinition(offer, createContractDraft({ buyerType: "b2c" })));
  const b2b = JSON.stringify(buildContractPdfDefinition(offer, createContractDraft({ buyerType: "b2b" })));
  assert.match(b2c, /Kupujący zawiera umowę jako konsument/);
  assert.match(b2b, /prowadzoną działalnością gospodarczą/);
});

test("contract generation is gated by offer acceptance in the UI", async () => {
  const source = await readFile(new URL("../components/Configurator.tsx", import.meta.url), "utf8");
  assert.match(source, /Oferta .* została zaakceptowana/);
  assert.match(source, /Generuj umowę/);
  assert.match(source, /item\.status === "accepted" && item\.payload/);
});
