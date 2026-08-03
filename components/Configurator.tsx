"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import catalog from "@/data/models.json";
import { calculateOfferPricing } from "@/lib/pricing";

type Version = { id: string; name: string; basePrice: number; standardEngines: string };
type Option = {
  id: string;
  sourceRow: number;
  description: string;
  price: number | null;
  priceOnRequest: boolean;
  defaultQuantity: number;
  category: string;
  note: string;
};
type Model = {
  id: string;
  name: string;
  tagline: string;
  versions: Version[];
  excellencePackage: { name: string; price: number; included: { sourceRow: number; description: string }[] };
  options: Option[];
  delivery: Option[];
  sourceSheet: string;
};
type Customer = {
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  email: string;
  country: string;
  deliveryPort: string;
  yachtName: string;
  notes: string;
};
type OfferPayloadSnapshot = {
  offerNumber: string;
  model: string;
  version: Version;
  selectedOptions: Array<Option & { quantity: number }>;
  calculation: {
    discountPercent: number;
    vatPercent: number;
    [key: string]: number;
  };
  customer: Customer;
  [key: string]: unknown;
};
type HistoryOffer = {
  number: string;
  model: string;
  customer: string;
  customerEmail?: string;
  version?: string;
  total: number;
  date: string;
  html?: string;
  payload?: OfferPayloadSnapshot;
};

const models = catalog.models as Model[];
const dealerEmail = "marek.stryjecki@katamaranbali.pl";
const publicConfiguratorUrl = process.env.NEXT_PUBLIC_PUBLIC_URL ?? "https://marekchorwacja-spec.github.io/OfertaBAli/";
const steps = ["Model", "Wersja", "Wyposażenie", "Podsumowanie", "Klient", "Oferta"];
const publicAsset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
const brochures = [
  { id: "bali-catsmart", model: "BALI CATSMART", pdf: publicAsset("/brochures/bali-catsmart.pdf"), cover: publicAsset("/images/brochures/bali-catsmart-cover-01.jpg"), pages: 20 },
  { id: "bali-catspace", model: "BALI CATSPACE", pdf: publicAsset("/brochures/bali-catspace.pdf"), cover: publicAsset("/images/brochures/bali-catspace-cover-01.jpg"), pages: 20 },
  { id: "bali-4-2", model: "BALI 4.2", pdf: publicAsset("/brochures/bali-4-2.pdf"), cover: publicAsset("/images/brochures/bali-4-2-cover-01.jpg"), pages: 20 },
  { id: "bali-4-4", model: "BALI 4.4", pdf: publicAsset("/brochures/bali-4-4.pdf"), cover: publicAsset("/images/brochures/bali-4-4-cover-01.jpg"), pages: 20 },
  { id: "bali-4-6", model: "BALI 4.6", pdf: publicAsset("/brochures/bali-4-6.pdf"), cover: publicAsset("/images/brochures/bali-4-6-cover-01.jpg"), pages: 20 },
  { id: "bali-5-2", model: "BALI 5.2", pdf: publicAsset("/brochures/bali-5-2.pdf"), cover: publicAsset("/images/brochures/bali-5-2-cover-01.jpg"), pages: 12 },
  { id: "bali-5-8", model: "BALI 5.8", pdf: publicAsset("/brochures/bali-5-8.pdf"), cover: publicAsset("/images/brochures/bali-5-8-cover-01.jpg"), pages: 24 },
  { id: "bali-7-0", model: "BALI 7.0", pdf: publicAsset("/brochures/bali-7-0-preview.pdf"), cover: publicAsset("/images/brochures/bali-7-0-cover-1.jpg"), pages: 9, release: "PREMIERA 2027" },
];
const modelPlans: Record<string, string> = {
  "bali-catsmart": publicAsset("/images/bali-catsmart-deck-plan.jpg"),
  "bali-catspace": publicAsset("/images/bali-catspace-deck-fly-plan.jpg"),
  "bali-4-2": publicAsset("/images/bali-4-2-flybridge-plan.jpg"),
  "bali-4-4": publicAsset("/images/bali-4-4-salon-plan.jpg"),
  "bali-4-6": publicAsset("/images/bali-4-6-flybridge-plan.jpg"),
  "bali-5-2": publicAsset("/images/bali-5-2-flybridge-plan.png"),
  "bali-5-8": publicAsset("/images/bali-5-8-deck-plan.jpg"),
};
const versionPlans: Record<string, string> = {
  "bali-catsmart-v2": publicAsset("/images/bali-catsmart-3-cabins-standard.jpg"),
  "bali-catsmart-v3": publicAsset("/images/bali-catsmart-2-cabins-standard.jpg"),
  "bali-catspace-v1": publicAsset("/images/bali-catspace-4-cabins.jpg"),
  "bali-catspace-v2": publicAsset("/images/bali-catspace-3-cabins.jpg"),
  "bali-4-2-v1": publicAsset("/images/bali-4-2-3-cabins.jpg"),
  "bali-4-2-v2": publicAsset("/images/bali-4-2-3-cabins.jpg"),
  "bali-4-2-v3": publicAsset("/images/bali-4-2-4-cabins-2-showers.jpg"),
  "bali-4-2-v4": publicAsset("/images/bali-4-2-4-cabins-4-showers.jpg"),
  "bali-4-4-v1": publicAsset("/images/bali-4-4-3-cabins.jpg"),
  "bali-4-4-v2": publicAsset("/images/bali-4-4-4-cabins-skipper.jpg"),
  "bali-4-6-v1": publicAsset("/images/bali-4-6-3-cabins-owner.jpg"),
  "bali-4-6-v3": publicAsset("/images/bali-4-6-4-cabins-3-heads.jpg"),
  "bali-4-6-v4": publicAsset("/images/bali-4-6-5-cabins-owner.jpg"),
  "bali-5-2-v2": publicAsset("/images/bali-5-2-4-cabins-owner.png"),
  "bali-5-2-v4": publicAsset("/images/bali-5-2-5-cabins.png"),
  "bali-5-2-v5": publicAsset("/images/bali-5-2-6-cabins.png"),
  "bali-5-8-v1": publicAsset("/images/bali-5-8-3-cabins.jpg"),
  "bali-5-8-v3": publicAsset("/images/bali-5-8-4-cabins.jpg"),
  "bali-5-8-v5": publicAsset("/images/bali-5-8-6-cabins-double.jpg"),
};
const versionPlanAlternatives: Record<string, string[]> = {
  "bali-catsmart-v2": [
    publicAsset("/images/bali-catsmart-3-cabins-starboard-forepeak.jpg"),
    publicAsset("/images/bali-catsmart-3-cabins-two-forepeaks.jpg"),
    publicAsset("/images/bali-catsmart-3-cabins-port-forepeak.jpg"),
  ],
  "bali-catsmart-v3": [
    publicAsset("/images/bali-catsmart-2-cabins-starboard-forepeak.jpg"),
    publicAsset("/images/bali-catsmart-2-cabins-two-forepeaks.jpg"),
    publicAsset("/images/bali-catsmart-2-cabins-port-forepeak.jpg"),
  ],
  "bali-4-4-v1": [publicAsset("/images/bali-4-4-3-cabins-skipper.jpg")],
  "bali-4-4-v2": [publicAsset("/images/bali-4-4-4-cabins-skipper-wc.jpg")],
  "bali-5-8-v5": [publicAsset("/images/bali-5-8-6-cabins-singles.jpg")],
};
const plansForVersion = (id: string) => versionPlans[id] ? [versionPlans[id], ...(versionPlanAlternatives[id] ?? [])] : [];
const brochureForModel = (item: Model) => brochures.find((brochure) => brochure.id === item.id);
const brochureUrlForModel = (item: Model) => {
  const brochure = brochureForModel(item);
  if (!brochure) return publicConfiguratorUrl;
  const fileName = brochure.pdf.split("/").pop() ?? "";
  return new URL(`brochures/${fileName}`, publicConfiguratorUrl).toString();
};
const brochureFileForModel = async (item: Model) => {
  const brochure = brochureForModel(item);
  if (!brochure) return null;
  const response = await fetch(brochure.pdf);
  if (!response.ok) throw new Error(`Nie udało się pobrać broszury ${item.name}`);
  const blob = await response.blob();
  const safeModelName = item.name.toLocaleLowerCase("pl").replaceAll(" ", "-").replaceAll(".", "-");
  return new File([blob], `broszura-${safeModelName}.pdf`, { type: "application/pdf" });
};
const cabinCount = (version: Version) => Number(version.name.match(/(\d+)\s*-?\s*kabin/i)?.[1] ?? 0);
const cabinLabel = (count: number) => `${count} ${count >= 2 && count <= 4 ? "kabiny" : "kabin"}`;
const cabinVersions = (item: Model) => Array.from(new Map(item.versions.map((itemVersion) => [cabinCount(itemVersion), itemVersion])).values());
const emptyCustomer: Customer = {
  firstName: "", lastName: "", company: "", phone: "", email: "", country: "Polska",
  deliveryPort: "", yachtName: "", notes: "",
};
const eur = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const money = (value: number) => eur.format(value);
const categoryAliases: Record<string, string> = {
  "Olinowanie i żagle": "Żagle",
  "Mechanika i wyposażenie bezpieczeństwa": "Silniki i bezpieczeństwo",
  "Mechanicy - Sprzęt Bezpieczeństwa": "Silniki i bezpieczeństwo",
  "Elektronika i audio": "Elektronika",
  "Wyposażenie zewnętrzne": "Pokład",
  "Zabudowa wnętrza": "Wnętrze",
  "Kolor tapicerki": "Wnętrze",
  "Przygotowanie i dostawa": "Dostawa",
};
const displayCategory = (category: string) => categoryAliases[category] ?? category;
const selectionKey = (item: Pick<Option, "id" | "category">) => `${displayCategory(item.category) === "Dostawa" ? "delivery" : "option"}:${item.id}`;

function download(name: string, content: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadBlob(name: string, blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function Configurator() {
  const [step, setStep] = useState(0);
  const [clientMode, setClientMode] = useState(false);
  const [offerSeed, setOfferSeed] = useState(() => Date.now());
  const [editingOfferNumber, setEditingOfferNumber] = useState<string | null>(null);
  const [modelId, setModelId] = useState(models[0].id);
  const model = models.find((item) => item.id === modelId) ?? models[0];
  const currentBrochure = brochures.find((item) => item.model === model.name);
  const [versionId, setVersionId] = useState(model.versions[0].id);
  const version = model.versions.find((item) => item.id === versionId) ?? model.versions[0];
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Wszystkie");
  const [maxPrice, setMaxPrice] = useState<number>(250000);
  const [discount, setDiscount] = useState(0);
  const [vat, setVat] = useState(23);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [dark, setDark] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareVersions, setCompareVersions] = useState<Record<string, string>>({});
  const [compareOpen, setCompareOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [brochuresOpen, setBrochuresOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planPreview, setPlanPreview] = useState("");
  const [history, setHistory] = useState<HistoryOffer[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem("oyc-offers") ?? window.localStorage.getItem("odisej-offers");
    const savedOffers = saved ? JSON.parse(saved) : [];
    return savedOffers.map((item: HistoryOffer) => ({
      ...item,
      number: item.number.replace(/^OY\//, "OYC/"),
    }));
  });
  const [historyPreview, setHistoryPreview] = useState<HistoryOffer | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!planOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setPlanOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [planOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get("client");
    const sharedModelId = clientParam === "1" ? params.get("model") : clientParam;
    const sharedModel = models.find((item) => item.id === sharedModelId);
    if (!sharedModel) return;
    setClientMode(true);
    setModelId(sharedModel.id);
    setVersionId(sharedModel.versions[0].id);
    setSelected({});
    setDiscount(0);
    setVat(23);
    setCustomer(emptyCustomer);
    setStep(2);
  }, []);

  const allOptions = [...model.options, ...model.delivery];
  const categories = ["Wszystkie", ...new Set(allOptions.map((item) => displayCategory(item.category)))];
  const filteredOptions = allOptions.filter((item) => {
    const matchesText = `${item.description} ${item.category}`.toLocaleLowerCase("pl").includes(search.toLocaleLowerCase("pl"));
    const matchesCategory = category === "Wszystkie" || displayCategory(item.category) === category;
    const matchesPrice = item.price === null || item.price <= maxPrice;
    return matchesText && matchesCategory && matchesPrice;
  });
  const chosenModelOptions = model.options.filter((item) => (selected[selectionKey(item)] ?? item.defaultQuantity) > 0);
  const chosenDelivery = model.delivery.filter((item) => (selected[selectionKey(item)] ?? item.defaultQuantity) > 0);
  const chosenOptions = [...chosenModelOptions, ...chosenDelivery];
  const { equipmentNet, deliveryNet, discountableSubtotal, subtotal, discountValue, configurationNetAfterDiscount, net, vatValue, gross } = calculateOfferPricing({
    basePrice: version.basePrice,
    excellencePrice: model.excellencePackage.price,
    options: chosenModelOptions.map((item) => ({ price: item.price, quantity: selected[selectionKey(item)] ?? item.defaultQuantity })),
    delivery: chosenDelivery.map((item) => ({ price: item.price, quantity: selected[selectionKey(item)] ?? item.defaultQuantity })),
    discountPercent: discount,
    vatPercent: vat,
  });
  const offerNumber = editingOfferNumber ?? `OYC/${new Date(offerSeed).getFullYear()}/${String(offerSeed).slice(-6)}`;

  const selectModel = (id: string) => {
    const next = models.find((item) => item.id === id) ?? models[0];
    setModelId(id);
    setVersionId(next.versions[0].id);
    setSelected({});
    setSearch("");
    setCategory("Wszystkie");
    setStep(2);
  };
  const startNewOffer = () => {
    setEditingOfferNumber(null);
    setOfferSeed(Date.now());
    setSelected({});
    setDiscount(0);
    setVat(23);
    setCustomer(emptyCustomer);
    setSearch("");
    setCategory("Wszystkie");
    setStep(1);
  };
  const toggleOption = (item: Option) => setSelected((current) => {
    const key = selectionKey(item);
    return { ...current, [key]: (current[key] ?? item.defaultQuantity) > 0 ? 0 : 1 };
  });
  const updateCustomer = (field: keyof Customer, value: string) => setCustomer((current) => ({ ...current, [field]: value }));
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const clientConfiguratorUrl = (item: Model) => {
    const url = new URL(publicConfiguratorUrl);
    url.search = "";
    url.hash = "";
    url.searchParams.set("client", item.id);
    return url.toString();
  };
  const copyClientConfigurator = async (item: Model) => {
    try {
      await navigator.clipboard.writeText(clientConfiguratorUrl(item));
      showToast(`Link do konfiguratora ${item.name} został skopiowany`);
    } catch {
      showToast("Nie udało się skopiować linku — użyj przycisku Wyślij link");
    }
  };
  const sendClientConfigurator = async (item: Model) => {
    const url = clientConfiguratorUrl(item);
    const brochureUrl = brochureUrlForModel(item);
    const title = `Skonfiguruj swój ${item.name} — Odisej Yacht Club`;
    const message = `Dzień dobry,\n\nproszę otworzyć poniższy link i samodzielnie wybrać wersję oraz wyposażenie katamaranu ${item.name}:\n\n${url}\n\nBroszura ${item.name} w formacie PDF:\n${brochureUrl}\n\nPo zakończeniu konfigurację można przesłać bezpośrednio do Odisej Yacht Club.`;
    let brochureFile: File | null = null;
    try {
      brochureFile = await brochureFileForModel(item);
    } catch {
      showToast("Broszura będzie dostępna w wiadomości jako bezpośredni link PDF");
    }
    const shareData: ShareData = { title, text: message, url, ...(brochureFile ? { files: [brochureFile] } : {}) };
    if (navigator.share && (!brochureFile || !navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        showToast("Link i broszura zostały przekazane do wysłania");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(message);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  const offerPayload = () => ({
    offerNumber,
    date: new Date().toISOString(),
    priceList: catalog.priceList,
    currency: catalog.currency,
    model: model.name,
    version,
    excellencePackage: model.excellencePackage,
    selectedOptions: chosenOptions.map((item) => ({ ...item, quantity: selected[selectionKey(item)] ?? item.defaultQuantity })),
    calculation: { basePrice: version.basePrice, excellence: model.excellencePackage.price, equipmentNet, deliveryNet, discountableSubtotal, subtotal, discountPercent: discount, discountValue, configurationNetAfterDiscount, net, vatPercent: vat, vatValue, gross },
    customer,
  });
  const offerHtml = () => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${offerNumber}</title><style>body{font-family:Arial;color:#10223f;max-width:900px;margin:40px auto;line-height:1.5}h1{font-family:Georgia;font-size:42px}.gold{color:#a77928}.row{display:flex;justify-content:space-between;gap:30px;border-bottom:1px solid #ddd;padding:10px 0}.section{margin-top:24px;padding:9px 0;color:#a77928;font-size:12px;font-weight:700;letter-spacing:.08em;border-bottom:2px solid #a77928}.calculation{margin-top:32px;border-top:2px solid #a77928}.discount{color:#9b3f3f}.total{margin-top:8px;padding:18px 14px;background:#10223f;color:#fff;border:0;font-size:24px;font-weight:700}.muted{color:#687489}img{width:120px}</style></head><body><p class="gold">ODISEJ YACHT CLUB · OFERTA ${offerNumber}</p><h1>${model.name}</h1><p>${version.name}</p><p class="muted">${customer.firstName} ${customer.lastName} · ${customer.company}</p><div class="section">JACHT, PAKIETY I WYPOSAŻENIE — PODLEGA RABATOWI</div>${chosenModelOptions.map((item) => { const quantity = selected[selectionKey(item)] ?? item.defaultQuantity; return `<div class="row"><span>${item.description}${quantity > 1 ? ` × ${quantity}` : ""}</span><strong>${item.price === null ? "Cena na zapytanie" : money(item.price * quantity)}</strong></div>`; }).join("")}${chosenDelivery.length ? `<div class="section">PRZYGOTOWANIE I DOSTAWA — BEZ RABATU</div>${chosenDelivery.map((item) => { const quantity = selected[selectionKey(item)] ?? item.defaultQuantity; return `<div class="row"><span>${item.description}${quantity > 1 ? ` × ${quantity}` : ""}</span><strong>${item.price === null ? "Cena na zapytanie" : money(item.price * quantity)}</strong></div>`; }).join("")}` : ""}<section class="calculation"><div class="row"><span>Suma jachtu, pakietów i wyposażenia przed rabatem</span><strong>${money(discountableSubtotal)}</strong></div><div class="row discount"><span>Rabat handlowy (${discount}%)</span><strong>− ${money(discountValue)}</strong></div><div class="row"><span>Cena jachtu i konfiguracji po rabacie</span><strong>${money(configurationNetAfterDiscount)}</strong></div><div class="row"><span>Przygotowanie i dostawa (bez rabatu)</span><strong>${money(deliveryNet)}</strong></div><div class="row"><span>Do zapłaty netto</span><strong>${money(net)}</strong></div><div class="row"><span>VAT (${vat}%)</span><strong>${money(vatValue)}</strong></div><div class="row total"><span>Do zapłaty brutto</span><span>${money(gross)}</span></div></section><p>Rabat dotyczy wyłącznie jachtu, pakietów i konfiguracji. Przygotowanie i dostawa są doliczane po rabacie w pełnej wartości.</p><p>Oferta ważna po pisemnym potwierdzeniu przez Odisej Yacht Club.</p><img alt="Kod QR oferty" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(offerNumber)}"></body></html>`;
  const saveOffer = () => {
    const record: HistoryOffer = {
      number: offerNumber,
      model: model.name,
      customer: `${customer.firstName} ${customer.lastName}`.trim() || "Klient",
      customerEmail: customer.email,
      version: version.name,
      total: gross,
      date: new Date().toLocaleDateString("pl-PL"),
      html: offerHtml(),
      payload: offerPayload(),
    };
    const next = [record, ...history.filter((item) => item.number !== record.number)].slice(0, 50);
    setHistory(next);
    localStorage.setItem("oyc-offers", JSON.stringify(next));
    showToast("Oferta zapisana w historii");
  };
  const exportJson = () => download(`${offerNumber.replaceAll("/", "-")}.json`, JSON.stringify(offerPayload(), null, 2), "application/json");
  const exportHtml = () => download(`${offerNumber.replaceAll("/", "-")}.html`, offerHtml(), "text/html");
  const createPdfBlob = async (historyItem?: HistoryOffer) => {
    const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
      import("pdfmake/build/pdfmake"),
      import("pdfmake/build/vfs_fonts"),
    ]);
    pdfMake.addVirtualFileSystem(pdfFonts);
    const payload = historyItem?.payload;
    const pdfNumber = historyItem?.number ?? offerNumber;
    const pdfModel = payload?.model ?? historyItem?.model ?? model.name;
    const pdfVersion = payload?.version.name ?? historyItem?.version ?? version.name;
    const pdfCustomer = payload?.customer ?? (historyItem ? { ...emptyCustomer, firstName: historyItem.customer, email: historyItem.customerEmail ?? "" } : customer);
    const pdfOptions = payload?.selectedOptions ?? (historyItem ? [] : chosenOptions.map((item) => ({ ...item, quantity: selected[selectionKey(item)] ?? item.defaultQuantity })));
    const calculation = payload?.calculation ?? (historyItem ? { basePrice: 0, excellence: 0, equipmentNet: 0, deliveryNet: 0, discountableSubtotal: historyItem.total, subtotal: historyItem.total, discountPercent: 0, discountValue: 0, configurationNetAfterDiscount: historyItem.total, net: historyItem.total, vatPercent: 0, vatValue: 0, gross: historyItem.total } : { basePrice: version.basePrice, excellence: model.excellencePackage.price, equipmentNet, deliveryNet, discountableSubtotal, subtotal, discountPercent: discount, discountValue, configurationNetAfterDiscount, net, vatPercent: vat, vatValue, gross });
    const pdfDeliveryNet = calculation.deliveryNet ?? 0;
    const pdfDiscountableSubtotal = calculation.discountableSubtotal ?? Math.max((calculation.subtotal ?? 0) - pdfDeliveryNet, 0);
    const pdfConfigurationNetAfterDiscount = calculation.configurationNetAfterDiscount ?? pdfDiscountableSubtotal - (calculation.discountValue ?? 0);
    const priceRows: Array<Array<string | { text: string; bold?: boolean; color?: string; alignment?: "right" }>> = [];

    if (!historyItem || payload) {
      priceRows.push(["Cena bazowa", { text: money(calculation.basePrice ?? 0), alignment: "right" }]);
      priceRows.push(["Pakiet Excellence", { text: money(calculation.excellence ?? 0), alignment: "right" }]);
      pdfOptions.forEach((item) => {
        const quantity = item.quantity || 1;
        const deliveryLabel = displayCategory(item.category) === "Dostawa" ? " · bez rabatu" : "";
        const label = `${quantity > 1 ? `${item.description} × ${quantity}` : item.description}${deliveryLabel}`;
        priceRows.push([label, { text: item.price === null ? "Cena na zapytanie" : money(item.price * quantity), alignment: "right" }]);
      });
    } else {
      priceRows.push(["Archiwalna wartość oferty", { text: money(historyItem.total), alignment: "right" }]);
    }

    const documentDefinition = {
      pageSize: "A4",
      pageMargins: [42, 48, 42, 52],
      info: { title: `Oferta ${pdfNumber}`, author: "Odisej Yacht Club" },
      defaultStyle: { font: "Roboto", fontSize: 9, color: "#10223f" },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `ODISEJ YACHT CLUB · ${pdfNumber}`, color: "#8d6a2d", margin: [42, 12, 0, 0] },
          { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#687489", margin: [0, 12, 42, 0] },
        ],
        fontSize: 8,
      }),
      content: [
        { text: "ODISEJ YACHT CLUB", style: "brand" },
        { text: `OFERTA ${pdfNumber}`, style: "offerNumber" },
        { columns: [
          { width: "*", stack: [{ text: pdfModel, style: "title" }, { text: pdfVersion, style: "subtitle" }] },
          { width: 155, stack: [{ text: "DATA OFERTY", style: "label" }, { text: historyItem?.date ?? new Date().toLocaleDateString("pl-PL"), bold: true }, { text: "WARTOŚĆ BRUTTO", style: "label", margin: [0, 12, 0, 2] }, { text: money(calculation.gross ?? historyItem?.total ?? gross), style: "headerTotal" }] },
        ], margin: [0, 20, 0, 22] },
        { text: "DANE KLIENTA", style: "section" },
        { table: { widths: [110, "*"], body: [
          ["Klient", `${pdfCustomer.firstName} ${pdfCustomer.lastName}`.trim() || "Nie podano"],
          ["Firma", pdfCustomer.company || "—"],
          ["E-mail", pdfCustomer.email || "—"],
          ["Telefon", pdfCustomer.phone || "—"],
          ["Port odbioru", pdfCustomer.deliveryPort || "—"],
        ] }, layout: "noBorders", margin: [0, 5, 0, 20] },
        { text: "KONFIGURACJA I WYPOSAŻENIE", style: "section" },
        { table: { headerRows: 1, widths: ["*", 120], body: [
          [{ text: "Pozycja", style: "tableHeader" }, { text: "Cena netto", style: "tableHeader", alignment: "right" }],
          ...priceRows,
        ] }, layout: "lightHorizontalLines", margin: [0, 5, 0, 22] },
        { text: "PODSUMOWANIE CENOWE", style: "section" },
        { table: { widths: ["*", 150], body: [
          ["Jacht, pakiety i konfiguracja przed rabatem", { text: money(pdfDiscountableSubtotal), alignment: "right" }],
          [{ text: `Rabat handlowy (${calculation.discountPercent ?? 0}%)`, color: "#9b3f3f" }, { text: `− ${money(calculation.discountValue ?? 0)}`, alignment: "right", color: "#9b3f3f" }],
          ["Cena jachtu i konfiguracji po rabacie", { text: money(pdfConfigurationNetAfterDiscount), alignment: "right", bold: true }],
          ["Przygotowanie i dostawa (bez rabatu)", { text: money(pdfDeliveryNet), alignment: "right", bold: true }],
          ["Do zapłaty netto", { text: money(calculation.net ?? 0), alignment: "right", bold: true }],
          [`VAT (${calculation.vatPercent ?? 0}%)`, { text: money(calculation.vatValue ?? 0), alignment: "right" }],
          [{ text: "DO ZAPŁATY BRUTTO", style: "totalLabel" }, { text: money(calculation.gross ?? 0), style: "totalValue", alignment: "right" }],
        ] }, layout: "lightHorizontalLines", margin: [0, 5, 0, 20] },
        { text: "Rabat dotyczy wyłącznie jachtu, pakietów i konfiguracji. Wszystkie pozycje przygotowania i dostawy są doliczane po rabacie w pełnej wartości.", bold: true, color: "#8d6a2d", fontSize: 8, margin: [0, 0, 0, 6] },
        { text: "Oferta ważna po pisemnym potwierdzeniu przez Odisej Yacht Club. Ceny i zakres wyposażenia należy zweryfikować przed zawarciem umowy.", color: "#687489", fontSize: 8 },
      ],
      styles: {
        brand: { fontSize: 11, bold: true, color: "#a77928", characterSpacing: 2 },
        offerNumber: { fontSize: 8, color: "#687489", margin: [0, 4, 0, 0] },
        title: { fontSize: 28, bold: true, color: "#10223f" },
        subtitle: { fontSize: 11, color: "#687489", margin: [0, 5, 0, 0] },
        label: { fontSize: 7, color: "#687489", characterSpacing: 1 },
        headerTotal: { fontSize: 16, bold: true, color: "#a77928" },
        section: { fontSize: 9, bold: true, color: "#a77928", characterSpacing: 1, margin: [0, 0, 0, 4] },
        tableHeader: { bold: true, color: "#ffffff", fillColor: "#10223f", margin: [4, 5, 4, 5] },
        totalLabel: { bold: true, color: "#ffffff", fillColor: "#10223f", margin: [4, 7, 4, 7] },
        totalValue: { bold: true, color: "#ffffff", fillColor: "#10223f", fontSize: 13, margin: [4, 5, 4, 5] },
      },
    } as TDocumentDefinitions;

    return pdfMake.createPdf(documentDefinition).getBlob();
  };
  const downloadPdf = async (historyItem?: HistoryOffer) => {
    if (!historyItem) saveOffer();
    showToast("Generowanie dokumentu PDF…");
    try {
      const blob = await createPdfBlob(historyItem);
      const number = historyItem?.number ?? offerNumber;
      downloadBlob(`${number.replaceAll("/", "-")}.pdf`, blob);
      showToast("Oferta PDF została pobrana");
    } catch {
      showToast("Nie udało się wygenerować dokumentu PDF");
    }
  };
  const sendEmail = async () => {
    saveOffer();
    const title = `Oferta ${offerNumber} – ${model.name}`;
    const brochureUrl = brochureUrlForModel(model);
    const message = `Dzień dobry,\n\nw załączniku przesyłamy konfigurację ${model.name}.\nWartość brutto: ${money(gross)}.\nNumer oferty: ${offerNumber}.\nOdbiorca: ${customer.email}\n\nBroszura ${model.name} w formacie PDF:\n${brochureUrl}\n\nOdisej Yacht Club (OYC)`;
    showToast("Przygotowywanie załącznika PDF…");
    let pdfBlob: Blob;
    try {
      pdfBlob = await createPdfBlob();
    } catch {
      showToast("Nie udało się wygenerować załącznika PDF");
      return;
    }
    const fileName = `${offerNumber.replaceAll("/", "-")}.pdf`;
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });
    let brochureFile: File | null = null;
    try {
      brochureFile = await brochureFileForModel(model);
    } catch {
      showToast("Oferta jest gotowa; broszura będzie dostępna w wiadomości jako link PDF");
    }
    const emailFiles = brochureFile ? [file, brochureFile] : [file];
    const shareData: ShareData = { title, text: message, files: emailFiles };

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        showToast("Oferta i broszura zostały przekazane jako załączniki PDF");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadBlob(fileName, pdfBlob);
    if (brochureFile) downloadBlob(brochureFile.name, brochureFile);
    showToast("Oferta i broszura zostały pobrane; wiadomość zawiera też bezpośredni link do broszury");
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${message}\n\nPliki PDF zostały pobrane na komputer i są gotowe do dołączenia do wiadomości.`);
    window.setTimeout(() => window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, "_self"), 350);
  };
  const sendConfigurationToDealer = async () => {
    saveOffer();
    const title = `Konfiguracja klienta ${model.name} — ${customer.firstName} ${customer.lastName}`;
    const message = `Dzień dobry,\n\nprzesyłam moją konfigurację katamaranu ${model.name}.\nWersja: ${version.name}.\nWartość katalogowa brutto: ${money(gross)}.\nNumer konfiguracji: ${offerNumber}.\n\nDane kontaktowe: ${customer.firstName} ${customer.lastName}, ${customer.email}, ${customer.phone}.`;
    showToast("Przygotowywanie konfiguracji PDF…");
    let pdfBlob: Blob;
    try {
      pdfBlob = await createPdfBlob();
    } catch {
      showToast("Nie udało się wygenerować konfiguracji PDF");
      return;
    }
    const fileName = `${offerNumber.replaceAll("/", "-")}-${model.id}.pdf`;
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });
    const shareData: ShareData = { title, text: `${message}\n\nAdresat: ${dealerEmail}`, files: [file] };

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        showToast("Konfiguracja została przekazana do wysłania");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadBlob(fileName, pdfBlob);
    showToast("PDF pobrany — dołącz go do otwartej wiadomości");
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${message}\n\nPlik ${fileName} został pobrany na urządzenie i należy dołączyć go do wiadomości.`);
    window.setTimeout(() => window.open(`mailto:${dealerEmail}?subject=${subject}&body=${body}`, "_self"), 350);
  };

  const historyDocument = (item: HistoryOffer) => item.html ?? `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${item.number}</title><style>body{font-family:Arial;color:#10223f;max-width:800px;margin:50px auto;line-height:1.6}.gold{color:#a77928}dl{border-top:1px solid #ddd}div{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #ddd}</style></head><body><p class="gold">ODISEJ YACHT CLUB · ARCHIWUM OFERT</p><h1>${item.number}</h1><dl><div><dt>Klient</dt><dd>${item.customer}</dd></div><div><dt>Model</dt><dd>${item.model}</dd></div><div><dt>Wartość brutto</dt><dd>${money(item.total)}</dd></div><div><dt>Data</dt><dd>${item.date}</dd></div></dl><p>Ta pozycja pochodzi ze starszej wersji historii i zawiera jedynie dane podsumowujące.</p></body></html>`;
  const removeHistoryOffer = (number: string) => {
    const next = history.filter((item) => item.number !== number);
    setHistory(next);
    localStorage.setItem("oyc-offers", JSON.stringify(next));
    setHistoryPreview(null);
    showToast("Oferta została usunięta z historii");
  };
  const editHistoryOffer = (item: HistoryOffer) => {
    if (!item.payload) {
      const savedModel = models.find((candidate) => candidate.name === item.model);
      if (!savedModel) {
        showToast("Model tej oferty nie występuje już w aktualnym katalogu");
        return;
      }
      const [firstName = "", ...lastNameParts] = item.customer.split(" ");
      setModelId(savedModel.id);
      setVersionId(savedModel.versions[0].id);
      setSelected({});
      setDiscount(0);
      setVat(23);
      setCustomer({ ...emptyCustomer, firstName, lastName: lastNameParts.join(" "), email: item.customerEmail ?? "" });
      setEditingOfferNumber(item.number);
      setSearch("");
      setCategory("Wszystkie");
      setHistoryPreview(null);
      setAdminOpen(false);
      setStep(3);
      showToast("Starsza oferta otwarta - wybierz ponownie wyposażenie i sprawdź wersję");
      return;
    }
    const savedModel = models.find((candidate) => candidate.name === item.payload?.model);
    const savedVersion = savedModel?.versions.find((candidate) => candidate.id === item.payload?.version.id);
    if (!savedModel || !savedVersion) {
      showToast("Model lub wersja tej oferty nie występuje już w aktualnym katalogu");
      return;
    }

    setModelId(savedModel.id);
    setVersionId(savedVersion.id);
    setSelected(Object.fromEntries(item.payload.selectedOptions.map((option) => [selectionKey(option), option.quantity])));
    setDiscount(item.payload.calculation.discountPercent ?? 0);
    setVat(item.payload.calculation.vatPercent ?? 23);
    setCustomer({ ...emptyCustomer, ...item.payload.customer });
    setEditingOfferNumber(item.number);
    setSearch("");
    setCategory("Wszystkie");
    setHistoryPreview(null);
    setAdminOpen(false);
    setStep(3);
    showToast(`Edycja oferty ${item.number}`);
  };

  return (
    <main className={dark ? "app dark" : "app light"}>
      <header className="topbar">
        <button className="brand" onClick={() => setStep(clientMode ? 2 : 0)} aria-label="Strona główna">
          <Image className="brand-logo" src={publicAsset("/images/odisej-yacht-club-gold-v2.png")} alt="Odisej Yacht Club" width={132} height={66} priority unoptimized />
        </button>
        <nav>
          {clientMode ? <span className="client-mode-label">KONFIGURATOR KLIENTA · {model.name}</span> : <><button onClick={() => setCompareOpen(true)}>Porównaj <span className="count">{compareIds.length}</span></button><button onClick={() => setAdminOpen(true)}>Panel administratora</button></>}
          <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Zmień motyw">{dark ? "☼" : "◐"}</button>
        </nav>
      </header>

      {step === 0 ? (
        <section className="hero">
          <div className="hero-art" aria-hidden="true"><div className="sun"><Image className="hero-bali-logo" src={publicAsset("/images/bali-catamarans-logo-white.png")} alt="" width={3507} height={2480} priority unoptimized/></div><div className="water"/></div>
          <div className="hero-content">
            <p className="eyebrow">BALI CATAMARANS · CENNIK A-2026</p>
            <h1>Twoja podróż.<br/><em>Skonfigurowana.</em></h1>
            <p className="lead">Stwórz spersonalizowaną ofertę katamaranu BALI — od układu kabin po ostatni detal wyposażenia.</p>
            <button className="primary" onClick={startNewOffer}>Rozpocznij konfigurację <span>→</span></button>
            <div className="hero-stats"><div><strong>{models.length + 1}</strong><span>modeli BALI</span></div><div><strong>{models.reduce((sum, item) => sum + item.versions.length, 0)}</strong><span>wersji kabinowych</span></div><div><strong>A-2026</strong><span>aktualny cennik</span></div></div>
          </div>
          <button type="button" className="scroll-cue" onClick={() => setBrochuresOpen(true)}>ODKRYJ KOLEKCJĘ <span>↓</span></button>
        </section>
      ) : (
        <>
          <section className="progress-wrap">
            <div className="progress-title"><button onClick={() => setStep(Math.max(clientMode ? 2 : 1, step - 1))}>← Wstecz</button><span>{clientMode ? `KONFIGURATOR KLIENTA · ${model.name}` : "KONFIGURATOR BALI A-2026"}</span><strong>{step} / 6</strong></div>
            <div className="progress-line">{steps.map((label, index) => <button key={label} className={step >= index + 1 ? "active" : ""} onClick={() => step > index + 1 && setStep(index + 1)}><i>{index + 1}</i><span>{label}</span></button>)}</div>
          </section>

          {step === 1 && <section className="content-stage"><SectionHead eyebrow="Krok 1" title="Wybierz swój model" text="Osiem charakterów. Jedna filozofia swobodnego życia na wodzie."/><div className="model-grid">{models.map((item, index) => <article className="model-card" key={item.id}><div className={`model-visual tone-${index}`}>{modelPlans[item.id] ? <Image className="model-plan-image" src={modelPlans[item.id]} alt={`Plan górnego pokładu ${item.name}`} fill sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" unoptimized/> : <><span>{item.name.replace("BALI ", "")}</span><div className="mini-yacht"/></>}</div><div className="model-body"><p>OD {money(Math.min(...item.versions.map((v) => v.basePrice)))}</p><h3>{item.name}</h3><span>{item.versions.length} {item.versions.length === 2 ? "wersje" : "wersji"} · {item.versions[0].standardEngines}</span><div><button className="primary small" onClick={() => selectModel(item.id)}>Wybierz</button><label className="compare-check"><input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => setCompareIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : ids.length < 3 ? [...ids, item.id] : ids)}/> Porównaj</label></div></div></article>)}<article className="model-card future-model-card"><div className="model-visual"><Image className="future-model-cover" src={publicAsset("/images/brochures/bali-7-0-cover-1.jpg")} alt="BALI 7.0 — premiera 2027" fill sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" priority unoptimized/><span className="future-badge">PREMIERA 2027</span></div><div className="model-body"><p>NOWY FLAGOWY MODEL</p><h3>BALI 7.0</h3><span>Światowa premiera w 2027 roku · oficjalny cennik zostanie opublikowany później</span><div><a className="primary small" href={publicAsset("/brochures/bali-7-0-preview.pdf")} target="_blank" rel="noreferrer">Zobacz broszurę</a><small>Cena wkrótce</small></div></div></article></div></section>}

          {step === 2 && <section className="content-stage narrow"><SectionHead eyebrow="Krok 2" title={`Wersja kabinowa ${model.name}`} text={model.tagline}/><div className="version-list">{model.versions.map((item) => <div key={item.id} className={versionId === item.id ? "version-choice expanded" : "version-choice"}><button className={versionId === item.id ? "version-card selected" : "version-card"} onClick={() => { setVersionId(item.id); setPlanOpen(false); setPlanPreview(""); }}><i>{versionId === item.id ? "✓" : ""}</i><span><b>{item.name}</b><small>{item.standardEngines}{versionPlans[item.id] ? ` · ${plansForVersion(item.id).length > 1 ? `${plansForVersion(item.id).length} plany wnętrza` : "plan wnętrza"}` : ""}</small></span><strong>{money(item.basePrice)}</strong></button>{versionId === item.id && versionPlans[item.id] && <section className="selected-version-preview" aria-label={`Wybrany plan: ${item.name}`}><header><div><p>WYBRANY UKŁAD WNĘTRZA</p><h3>{item.name}</h3></div><button type="button" onClick={() => { setPlanPreview(versionPlans[item.id]); setPlanOpen(true); }}>Powiększ plan <span>↗</span></button></header><div className={plansForVersion(item.id).length > 1 ? "selected-plan-gallery multiple" : "selected-plan-gallery"}>{plansForVersion(item.id).map((planSrc, planIndex) => <button type="button" className="selected-plan-image" key={planSrc} onClick={() => { setPlanPreview(planSrc); setPlanOpen(true); }} aria-label={`Powiększ ${plansForVersion(item.id).length > 1 ? `wariant ${planIndex + 1}` : "plan"}: ${item.name}`}><Image src={planSrc} alt={`${plansForVersion(item.id).length > 1 ? `Wariant ${planIndex + 1} — ` : ""}plan: ${item.name}`} fill sizes={plansForVersion(item.id).length > 1 ? "(max-width: 720px) 100vw, 500px" : "(max-width: 720px) 100vw, 1000px"} unoptimized/>{plansForVersion(item.id).length > 1 && <span>Wariant {planIndex + 1}</span>}</button>)}</div><p className="plan-hint">Kliknij plan, aby obejrzeć szczegóły na pełnym ekranie</p></section>}</div>)}</div><div className="package-panel"><div><p>PAKIET FABRYCZNY</p><h3>{model.excellencePackage.name}</h3><span>{model.excellencePackage.included.length} pozycji wyposażenia w pakiecie</span></div><strong>{money(model.excellencePackage.price)}</strong><details><summary>Zobacz pełną specyfikację</summary><ul>{model.excellencePackage.included.map((item) => <li key={item.sourceRow}>{item.description}</li>)}</ul></details></div><StepFooter price={version.basePrice + model.excellencePackage.price} onNext={() => setStep(3)}/></section>}

          {step === 3 && <section className="content-stage equipment-stage"><SectionHead eyebrow="Krok 3" title="Wyposażenie dodatkowe" text={`${allOptions.length} pozycji z cennika ${model.name}. Wybierz to, co definiuje Twój styl podróżowania.`}/>{editingOfferNumber && <div className="edit-offer-banner"><span>EDYTUJESZ OFERTĘ</span><strong>{editingOfferNumber}</strong><button type="button" onClick={startNewOffer}>Anuluj edycję</button></div>}<div className="equipment-layout"><aside className="filters"><label>WYSZUKAJ<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="np. generator, Raymarine…"/></label><label>KATEGORIA<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>CENA DO <b>{money(maxPrice)}</b><input type="range" min="1000" max="250000" step="1000" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}/></label><button className="ghost" onClick={() => { setSearch(""); setCategory("Wszystkie"); setMaxPrice(250000); }}>Wyczyść filtry</button></aside><div className="option-list"><div className="results"><span>{filteredOptions.length} wyników</span><span>{chosenOptions.length} wybranych</span></div>{filteredOptions.map((item) => { const key = selectionKey(item); const qty = selected[key] ?? item.defaultQuantity; return <article key={key} className={qty > 0 ? "option-card selected" : "option-card"} onClick={() => toggleOption(item)}><button aria-label={qty > 0 ? "Usuń opcję" : "Dodaj opcję"}>{qty > 0 ? "✓" : "+"}</button><div><p>{displayCategory(item.category)}</p><h4>{item.description}</h4>{displayCategory(item.category) === "Dostawa" && <small>Ta pozycja nie podlega rabatowi</small>}{item.note && <small>{item.note}</small>}</div><strong>{item.priceOnRequest || item.price === null ? "Cena na zapytanie" : `+ ${money(item.price)}`}</strong></article>})}</div><aside className="live-summary"><p>TWOJA KONFIGURACJA</p><h3>{model.name}</h3><span>{version.name}</span><dl><div><dt>Cena bazowa</dt><dd>{money(version.basePrice)}</dd></div><div><dt>Excellence</dt><dd>{money(model.excellencePackage.price)}</dd></div><div><dt>Opcje ({chosenModelOptions.length})</dt><dd>{money(equipmentNet)}</dd></div><div><dt>Dostawa — bez rabatu ({chosenDelivery.length})</dt><dd>{money(deliveryNet)}</dd></div></dl><div className="summary-total"><span>RAZEM NETTO PRZED RABATEM</span><strong>{money(subtotal)}</strong></div><button className="primary" onClick={() => setStep(4)}>Podsumowanie →</button></aside></div></section>}

          {step === 4 && <section className="content-stage narrow"><SectionHead eyebrow="Krok 4" title="Podsumowanie konfiguracji" text={clientMode ? "To kalkulacja według aktualnego cennika. Indywidualne warunki handlowe potwierdzi Odisej Yacht Club." : "Rabat obejmuje jacht, pakiety i konfigurację. Przygotowanie i dostawa są zawsze doliczane w pełnej wartości."}/><div className="summary-layout"><div className="summary-sheet"><h3>{model.name}</h3><p>{version.name}</p><div className="price-section-label">PODLEGA RABATOWI</div><PriceRow label="Cena bazowa" value={version.basePrice}/><PriceRow label="Pakiet Excellence" value={model.excellencePackage.price}/>{chosenModelOptions.map((item) => <PriceRow key={item.id} label={item.description} value={item.price}/>) }{chosenDelivery.length > 0 && <><div className="price-section-label no-discount">PRZYGOTOWANIE I DOSTAWA — BEZ RABATU</div>{chosenDelivery.map((item) => <PriceRow key={item.id} label={item.description} value={item.price}/>)}</>}</div><div className="calculation-card">{clientMode ? <div className="client-pricing-note"><strong>WARUNKI HANDLOWE USTALA DEALER</strong><span>Konfigurator klienta pokazuje ceny katalogowe z VAT 23%. Rabat nie jest dostępny w tym trybie.</span></div> : <><label>Rabat handlowy <span><input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(Number(e.target.value))}/>%</span></label><label>Stawka VAT <span><input type="number" min="0" max="100" value={vat} onChange={(e) => setVat(Number(e.target.value))}/>%</span></label></>}<dl><div><dt>Jacht, pakiety i konfiguracja przed rabatem</dt><dd>{money(discountableSubtotal)}</dd></div>{!clientMode && <><div><dt>Rabat ({discount}%)</dt><dd>− {money(discountValue)}</dd></div><div><dt>Cena konfiguracji po rabacie</dt><dd>{money(configurationNetAfterDiscount)}</dd></div></>}<div className="no-discount-row"><dt>Przygotowanie i dostawa — bez rabatu</dt><dd>+ {money(deliveryNet)}</dd></div><div><dt>Do zapłaty netto</dt><dd>{money(net)}</dd></div><div><dt>VAT ({vat}%)</dt><dd>{money(vatValue)}</dd></div></dl><div className="grand-total"><span>DO ZAPŁATY BRUTTO</span><strong>{money(gross)}</strong></div></div></div><div className="export-strip"><button onClick={() => void downloadPdf()}>Pobierz PDF</button>{currentBrochure && <a className="brochure-download-button" href={currentBrochure.pdf} download>Pobierz broszurę</a>}{!clientMode && <><button onClick={exportHtml}>Eksport HTML</button><button onClick={exportJson}>Eksport JSON</button></>}</div><StepFooter price={gross} gross onNext={() => setStep(5)}/></section>}

          {step === 5 && <section className="content-stage narrow"><SectionHead eyebrow="Krok 5" title="Dane klienta" text={clientMode ? "Podaj dane kontaktowe, aby przesłać wybraną konfigurację do Odisej Yacht Club." : "Dane zostaną umieszczone na spersonalizowanej ofercie."}/><form className="customer-form" onSubmit={(e) => { e.preventDefault(); saveOffer(); setStep(6); }}><div className="field-grid"><Field label="Imię" required value={customer.firstName} onChange={(v) => updateCustomer("firstName", v)}/><Field label="Nazwisko" required value={customer.lastName} onChange={(v) => updateCustomer("lastName", v)}/><Field label="Firma" value={customer.company} onChange={(v) => updateCustomer("company", v)}/><Field label="Telefon" value={customer.phone} onChange={(v) => updateCustomer("phone", v)}/><Field label="E-mail" type="email" required value={customer.email} onChange={(v) => updateCustomer("email", v)}/><Field label="Kraj" value={customer.country} onChange={(v) => updateCustomer("country", v)}/><Field label="Port odbioru" value={customer.deliveryPort} onChange={(v) => updateCustomer("deliveryPort", v)}/><Field label="Nazwa jachtu" value={customer.yachtName} onChange={(v) => updateCustomer("yachtName", v)}/></div><label className="textarea-field">Uwagi<textarea rows={5} value={customer.notes} onChange={(e) => updateCustomer("notes", e.target.value)} placeholder="Termin odbioru, sposób finansowania, dodatkowe informacje…"/></label><button className="primary form-submit" type="submit">{clientMode ? "Zakończ konfigurację →" : "Przygotuj ofertę →"}</button></form></section>}

          {step === 6 && <section className="content-stage offer-ready"><div className="success-mark">✓</div><p className="eyebrow">{clientMode ? "KONFIGURACJA KLIENTA GOTOWA" : editingOfferNumber ? "OFERTA ZAKTUALIZOWANA" : "OFERTA GOTOWA"}</p><h2>{model.name} czeka na swojego właściciela.</h2><p>{clientMode ? <>Konfiguracja <b>{offerNumber}</b> jest gotowa. Prześlij ją do Odisej Yacht Club, aby otrzymać potwierdzenie ceny i indywidualne warunki handlowe.</> : <>Oferta <b>{offerNumber}</b> dla {customer.firstName} {customer.lastName} została przygotowana. Wybierz sposób przekazania dokumentu.</>}</p><div className="offer-card"><div><span>WARTOŚĆ BRUTTO</span><strong>{money(gross)}</strong><small>{chosenOptions.length} opcji · {version.name}</small></div><div className="qr">OYC<small>QR</small></div></div><div className="offer-actions">{clientMode ? <button className="primary" onClick={() => void sendConfigurationToDealer()}>Wyślij konfigurację do OYC</button> : <button className="primary" onClick={() => void sendEmail()}>Wyślij z załącznikiem PDF</button>}<button onClick={() => void downloadPdf()}>Pobierz PDF</button>{currentBrochure && <a className="brochure-download-button" href={currentBrochure.pdf} download>Pobierz broszurę</a>}{!clientMode && <><button onClick={exportHtml}>Pobierz HTML</button><button onClick={exportJson}>Pobierz JSON</button></>}</div>{!clientMode && <button className="text-button" onClick={startNewOffer}>Utwórz nową konfigurację</button>}</section>}
        </>
      )}

      {compareOpen && <Modal title="Porównanie modeli" onClose={() => setCompareOpen(false)}><div className="compare-picker">{models.map((item) => <label key={item.id}><input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => setCompareIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : ids.length < 3 ? [...ids, item.id] : ids)}/>{item.name}</label>)}</div>{compareIds.length ? <div className="compare-table"><div/><b>Cena</b><b>Wersja kabinowa</b><b>Silniki standardowe</b>{compareIds.map((id) => { const item = models.find((candidate) => candidate.id === id)!; const availableCabinVersions = cabinVersions(item); const selectedCabinVersion = availableCabinVersions.find((itemVersion) => itemVersion.id === compareVersions[id]) ?? availableCabinVersions[0]; return <div className="compare-column" key={id}><h3>{item.name}</h3><span>{money(selectedCabinVersion.basePrice)}</span><span><select aria-label={`Wersja kabinowa ${item.name}`} value={selectedCabinVersion.id} onChange={(event) => setCompareVersions((current) => ({ ...current, [id]: event.target.value }))}>{availableCabinVersions.map((itemVersion) => <option value={itemVersion.id} key={itemVersion.id}>{cabinLabel(cabinCount(itemVersion))}</option>)}</select></span><span>{selectedCabinVersion.standardEngines}</span></div>; })}</div> : <p className="empty">Wybierz maksymalnie trzy modele do porównania.</p>}</Modal>}
      {brochuresOpen && <Modal title="Kolekcja BALI" onClose={() => setBrochuresOpen(false)}><p className="brochure-intro">Poznaj całą gamę katamaranów BALI. Otwórz broszurę w przeglądarce albo pobierz ją na urządzenie.</p><div className="brochure-grid">{brochures.map((item) => <article className={item.release ? "brochure-card future-brochure" : "brochure-card"} key={item.model}><div className="brochure-cover"><Image src={item.cover} alt={`Okładka broszury ${item.model}`} fill sizes="(max-width: 720px) 80vw, (max-width: 1100px) 40vw, 280px" unoptimized/>{item.release && <span className="brochure-release">{item.release}</span>}</div><div className="brochure-info"><p>BROSZURA PRODUKTOWA · {item.pages} STRON</p><h3>{item.model}</h3><div><a href={item.pdf} target="_blank" rel="noreferrer">Otwórz broszurę <span>↗</span></a><a href={item.pdf} download>Pobierz PDF <span>↓</span></a></div></div></article>)}</div></Modal>}
      {adminOpen && <Modal title="Panel administratora" onClose={() => setAdminOpen(false)}><div className="admin-kpis"><div><strong>{models.length}</strong><span>modeli</span></div><div><strong>{models.reduce((sum, item) => sum + item.options.length + item.delivery.length, 0)}</strong><span>pozycji cenowych</span></div><div><strong>{history.length}</strong><span>zapisanych ofert</span></div></div><div className="admin-actions"><label>Wybierz nowy Excel<input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && showToast(`Wybrano ${e.target.files[0].name}. Plik oczekuje na walidację i publikację katalogu.`)}/></label><button onClick={() => download("katalog-bali-a-2026.json", JSON.stringify(catalog, null, 2), "application/json")}>Eksport danych katalogu</button></div><h3>Konfiguratory dla klientów</h3><p className="admin-section-intro">Wyślij klientowi link do wybranego modelu. Wiadomość zawiera również właściwą broszurę PDF. Klient sam wybierze wersję, wyposażenie i prześle gotową konfigurację do OYC.</p><div className="client-link-list">{models.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.versions.length} {item.versions.length === 2 ? "wersje" : "wersji"} · {item.options.length + item.delivery.length} pozycji</small></span><button type="button" onClick={() => void copyClientConfigurator(item)}>Kopiuj link</button><button type="button" className="primary" onClick={() => void sendClientConfigurator(item)}>Wyślij link + broszurę</button></div>)}</div><h3>Historia ofert</h3><div className="history-list">{history.length ? history.map((item) => <div className="history-row" key={item.number}><span><b>{item.number}</b><small>{item.customer} · {item.model}{item.version ? ` · ${item.version}` : ""}</small></span><strong>{money(item.total)}</strong><time>{item.date}</time><div className="history-row-actions"><button type="button" onClick={() => { setHistoryPreview(item); setAdminOpen(false); }}>Podgląd</button><button type="button" className="primary" onClick={() => editHistoryOffer(item)}>Edytuj ofertę</button></div></div>) : <p className="empty">Historia pojawi się po przygotowaniu pierwszej oferty.</p>}</div><p className="admin-note">Przycisk „Edytuj ofertę” otwiera bezpośrednio konfigurator wyposażenia. Nowe oferty odtwarzają całą konfigurację; w starszych wpisach wyposażenie należy wybrać ponownie.</p></Modal>}
      {historyPreview && <Modal title={`Oferta ${historyPreview.number}`} onClose={() => setHistoryPreview(null)}><div className="history-detail-head"><div><span>KLIENT</span><strong>{historyPreview.customer}</strong><small>{historyPreview.customerEmail || "Brak adresu e-mail"}</small></div><div><span>MODEL</span><strong>{historyPreview.model}</strong><small>{historyPreview.version || "Wersja nie została zapisana"}</small></div><div><span>WARTOŚĆ BRUTTO</span><strong>{money(historyPreview.total)}</strong><small>{historyPreview.date}</small></div></div><iframe className="history-document" title={`Podgląd ${historyPreview.number}`} srcDoc={historyDocument(historyPreview)}/><div className="history-detail-actions"><button className="primary" onClick={() => editHistoryOffer(historyPreview)}>Edytuj ofertę</button><button onClick={() => void downloadPdf(historyPreview)}>Pobierz PDF</button><button onClick={() => { const frame = window.open("", "_blank", "width=1000,height=800"); if (!frame) return showToast("Zezwól przeglądarce na otwieranie okien"); frame.document.write(historyDocument(historyPreview)); frame.document.close(); frame.setTimeout(() => frame.print(), 300); }}>Drukuj</button><button className="danger" onClick={() => removeHistoryOffer(historyPreview.number)}>Usuń z historii</button></div></Modal>}
      {planOpen && planPreview && <div className="plan-lightbox"><button className="plan-lightbox-backdrop" onClick={() => setPlanOpen(false)} aria-label="Zamknij powiększony plan"/><section className="plan-lightbox-dialog" role="dialog" aria-modal="true" aria-label={`Plan: ${version.name}`}><header><div><p>{model.name} · PLAN WNĘTRZA</p><h2>{version.name}</h2></div><button onClick={() => setPlanOpen(false)} aria-label="Zamknij">×</button></header><div className="plan-lightbox-image"><Image src={planPreview} alt={`Powiększony plan: ${version.name}`} fill sizes="96vw" priority unoptimized/></div></section></div>}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <header className="section-head"><p>{eyebrow}</p><h2>{title}</h2><span>{text}</span></header>;
}
function StepFooter({ price, gross = false, onNext }: { price: number; gross?: boolean; onNext: () => void }) {
  return <div className="step-footer"><span>{gross ? "RAZEM BRUTTO" : "AKTUALNA WARTOŚĆ NETTO"}<strong>{money(price)}</strong></span><button className="primary" onClick={onNext}>Dalej →</button></div>;
}
function PriceRow({ label, value }: { label: string; value: number | null }) {
  return <div className="price-row"><span>{label}</span><strong>{value === null ? "Cena na zapytanie" : money(value)}</strong></div>;
}
function Field({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className="field">{label}{required && <b>*</b>}<input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)}/></label>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={(e) => e.stopPropagation()}><header><p>ODISEJ YACHT CLUB · OYC</p><h2>{title}</h2><button onClick={onClose}>×</button></header>{children}</section></div>;
}
