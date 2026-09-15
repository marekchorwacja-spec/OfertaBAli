export function hasConfigurableQuantity(item: { description: string }) {
  const description = item.description.toLocaleLowerCase("pl");
  return description.includes("wentylator")
    || (description.includes("toalet") && (description.includes("elektrycz") || description.includes("planus relax")))
    || (description.includes("siedzisko") && description.includes("stołu w salonie"))
    || (description.includes("paneli słonecznych") && description.includes("1 lub 2"));
}

export function maxConfigurableQuantity(item: { description: string }) {
  const description = item.description.toLocaleLowerCase("pl");
  return description.includes("paneli słonecznych") && description.includes("1 lub 2") ? 2 : 99;
}
