export function hasConfigurableQuantity(item: { description: string }) {
  const description = item.description.toLocaleLowerCase("pl");
  return description.includes("wentylator")
    || (description.includes("toalet") && (description.includes("elektrycz") || description.includes("planus relax")))
    || (description.includes("siedzisko") && description.includes("stołu w salonie"));
}
