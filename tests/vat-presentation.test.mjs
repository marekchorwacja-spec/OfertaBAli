import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configuratorUrl = new URL("../components/Configurator.tsx", import.meta.url);

test("all offer formats present net pricing without automatically charging VAT", async () => {
  const source = await readFile(configuratorUrl, "utf8");

  assert.match(source, /const vatSettlementLabel = "VAT: rozliczany zgodnie z miejscem i warunkami dostawy"/);
  assert.match(source, /CENA OFERTOWA NETTO/);
  assert.match(source, /ZASADY ROZLICZENIA PODATKU VAT/);
  assert.match(source, /W przypadku gdy miejscem dostawy i opodatkowania będzie Chorwacja/);
  assert.match(source, /vatPercent: 0/);
  assert.doesNotMatch(source, /useState\(23\)/);
  assert.doesNotMatch(source, /Stawka VAT/);
  assert.doesNotMatch(source, /VAT \(23%\)|VAT \(25%\)/);
});

test("PDF equipment table continues to identify prices as net", async () => {
  const source = await readFile(configuratorUrl, "utf8");

  assert.match(source, /\{ text: "Cena netto", style: "tableHeader", alignment: "right" \}/);
});
