import type { TDocumentDefinitions } from "pdfmake/interfaces";

export type BuyerType = "b2c" | "b2b";

export type ContractDraft = {
  buyerType: BuyerType;
  contractDate: string;
  customerAddress: string;
  customerId: string;
  modelYear: string;
  hullNumber: string;
  engineSerials: string;
  payment1: string;
  paymentDate1: string;
  payment2: string;
  paymentDate2: string;
  payment3: string;
  paymentDate3: string;
  finalPayment: string;
  finalPaymentDate: string;
  pickupDate: string;
  pickupPlace: string;
  destination: string;
  otherCosts: string;
  specialTerms: string;
  copies: string;
};

export type ContractOfferData = {
  offerNumber: string;
  contractNumber: string;
  offerDate: string;
  model: string;
  version: string;
  engines: string;
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerPhone: string;
  yachtName: string;
  basePrice: number;
  excellenceName: string;
  excellencePrice: number;
  options: Array<{ description: string; price: number | null; quantity: number; category: string }>;
  yachtNet: number;
  deliveryNet: number;
  totalNet: number;
};

export const seller = {
  name: "ODISEJ YACHT CLUB d.o.o.",
  address: "Put Bioca 2/A, 22000 Šibenik, Chorwacja",
  oib: "07271791929",
  vatId: "HR07271791929",
  representative: "Marek Michal Stryjecki",
};

export function contractNumberForOffer(offerNumber: string) {
  const normalized = offerNumber.replace(/^OYC\//, "");
  return `OYC/US/${normalized}`;
}

export function createContractDraft(input: {
  buyerType?: BuyerType;
  customerAddress?: string;
  customerId?: string;
  deliveryPort?: string;
  destinationCountry?: string;
} = {}): ContractDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    buyerType: input.buyerType ?? "b2c",
    contractDate: today,
    customerAddress: input.customerAddress ?? "",
    customerId: input.customerId ?? "",
    modelYear: "2027",
    hullNumber: "",
    engineSerials: "",
    payment1: "",
    paymentDate1: "",
    payment2: "",
    paymentDate2: "",
    payment3: "",
    paymentDate3: "",
    finalPayment: "",
    finalPaymentDate: "",
    pickupDate: "",
    pickupPlace: input.deliveryPort || "Gdynia",
    destination: [input.deliveryPort, input.destinationCountry].filter(Boolean).join(", "),
    otherCosts: "0 EUR netto",
    specialTerms: "",
    copies: "2",
  };
}

const money = (value: number) => `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value)} EUR`;
const valueOrPending = (value: string, fallback = "do uzgodnienia") => value.trim() || fallback;
const paragraph = (text: string, bold = false) => ({ text, bold, margin: [0, 0, 0, 6], lineHeight: 1.25 });
const section = (title: string) => ({ text: title, style: "section" });

export function buildContractPdfDefinition(offer: ContractOfferData, draft: ContractDraft, logoDataUrl?: string): TDocumentDefinitions {
  const buyerName = draft.buyerType === "b2b" && offer.customerCompany ? offer.customerCompany : offer.customerName;
  const buyerLabel = draft.buyerType === "b2c" ? "Konsument B2C" : "Przedsiębiorca B2B";
  const hullNumber = valueOrPending(draft.hullNumber, "zostanie uzupełniony po nadaniu przez producenta");
  const engineSerials = valueOrPending(draft.engineSerials, "zostaną uzupełnione po nadaniu przez producenta");
  const specialTerms = valueOrPending(draft.specialTerms, "Brak dodatkowych warunków specjalnych.");
  const consumerClause = draft.buyerType === "b2c"
    ? "Kupujący zawiera umowę jako konsument. Żadne postanowienie umowy nie wyłącza ani nie ogranicza praw konsumenta wynikających z bezwzględnie obowiązujących przepisów. Jeżeli umowa jest zawierana na odległość lub poza lokalem przedsiębiorstwa, uprawnienia informacyjne i prawo odstąpienia stosuje się zgodnie z właściwymi przepisami, z uwzględnieniem ustawowych wyjątków dotyczących rzeczy wykonywanych według specyfikacji konsumenta lub wyraźnie spersonalizowanych."
    : "Kupujący zawiera umowę w związku z prowadzoną działalnością gospodarczą lub zawodową. Postanowienia przeznaczone wyłącznie dla konsumentów nie mają zastosowania, chyba że bezwzględnie obowiązujące przepisy stanowią inaczej.";
  const lawClause = draft.buyerType === "b2c"
    ? "Do umowy stosuje się prawo Republiki Chorwacji, jednak wybór ten nie pozbawia Kupującego ochrony przyznanej mu przez przepisy, których nie można wyłączyć w drodze umowy, właściwe zgodnie z prawem Unii Europejskiej. Właściwość sądu ustala się z uwzględnieniem bezwzględnie obowiązujących przepisów chroniących konsumenta."
    : "Do umowy stosuje się prawo Republiki Chorwacji. Strony będą w pierwszej kolejności dążyć do polubownego rozwiązania sporu, a właściwość sądu zostanie ustalona zgodnie z obowiązującymi przepisami.";

  const paymentRows = [
    ["I rata / zaliczka", valueOrPending(draft.payment1), valueOrPending(draft.paymentDate1)],
    ["II rata", valueOrPending(draft.payment2), valueOrPending(draft.paymentDate2)],
    ["III rata", valueOrPending(draft.payment3), valueOrPending(draft.paymentDate3)],
    ["Płatność końcowa", valueOrPending(draft.finalPayment), valueOrPending(draft.finalPaymentDate)],
  ];
  const equipmentRows = offer.options.map((item) => {
    const quantity = Math.max(1, item.quantity || 1);
    return [
      `${item.description}${quantity > 1 ? ` × ${quantity}` : ""}`,
      item.price === null ? "Cena na zapytanie" : money(item.price * quantity),
    ];
  });

  const definition = {
    pageSize: "A4",
    pageMargins: [46, 48, 46, 54],
    info: { title: `Umowa sprzedaży katamaranu ${offer.contractNumber}`, author: seller.name },
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#17263d" },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${seller.name} · ${offer.contractNumber}`, color: "#8d6a2d", margin: [46, 12, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#687489", margin: [0, 12, 46, 0] },
      ],
      fontSize: 7.5,
    }),
    content: [
      ...(logoDataUrl ? [{ image: logoDataUrl, width: 121, height: 48, margin: [0, 0, 0, 8] }] : [{ text: seller.name, style: "brand" }]),
      { text: "UMOWA SPRZEDAŻY KATAMARANU", style: "title" },
      { columns: [
        { width: "*", stack: [{ text: `Nr umowy: ${offer.contractNumber}`, bold: true }, { text: `Powiązana oferta: ${offer.offerNumber}`, color: "#687489", margin: [0, 4, 0, 0] }] },
        { width: 170, stack: [{ text: "DATA ZAWARCIA", style: "label" }, { text: valueOrPending(draft.contractDate), bold: true }, { text: buyerLabel, style: "buyerBadge", margin: [0, 8, 0, 0] }] },
      ], margin: [0, 12, 0, 20] },
      { text: "STRONY UMOWY", style: "section" },
      { table: { widths: [90, "*", 90, "*"], body: [
        [{ text: "SPRZEDAWCA", style: "tableHeader" }, { text: seller.name, style: "tableHeader" }, { text: "KUPUJĄCY", style: "tableHeader" }, { text: buyerName || "Nie podano", style: "tableHeader" }],
        ["Adres", seller.address, "Adres", valueOrPending(draft.customerAddress, "do uzupełnienia")],
        ["OIB / VAT ID", `${seller.oib} / ${seller.vatId}`, draft.buyerType === "b2c" ? "PESEL / dokument" : "NIP / VAT UE", valueOrPending(draft.customerId, "do uzupełnienia")],
        ["Reprezentant", seller.representative, "E-mail / telefon", `${offer.customerEmail || "—"} / ${offer.customerPhone || "—"}`],
      ] }, layout: "lightHorizontalLines", margin: [0, 4, 0, 18] },

      section("§1 PRZEDMIOT UMOWY"),
      paragraph("1. Przedmiotem umowy jest sprzedaż nowego katamaranu marki BALI, zgodnego ze specyfikacją i wyposażeniem określonym w umowie oraz załącznikach."),
      { table: { widths: [135, "*"], body: [
        ["Producent", "CATANA GROUP / BALI CATAMARANS"], ["Model", offer.model], ["Wersja", offer.version], ["Rok modelowy / produkcji", valueOrPending(draft.modelYear)], ["HIN / CIN", hullNumber], ["Silniki", offer.engines], ["Numery seryjne silników", engineSerials], ["Nazwa jachtu", offer.yachtName || "—"],
      ] }, layout: "lightHorizontalLines", margin: [0, 2, 0, 10] },
      paragraph("2. Szczegółowa konfiguracja i wyposażenie zostały określone w Załączniku nr 1, który stanowi integralną część umowy."),
      paragraph("3. Numery HIN/CIN i numery seryjne silników nieznane w dniu podpisania umowy zostaną uzupełnione po ich nadaniu, najpóźniej w dokumentacji przekazania katamaranu."),

      section("§2 CENA I PODATEK VAT"),
      paragraph(`1. Uzgodniona cena sprzedaży wynosi ${money(offer.totalNet)} netto. Cena jachtu wraz z konfiguracją: ${money(offer.yachtNet)} netto. Przygotowanie, transport i dostawa: ${money(offer.deliveryNet)} netto. Inne uzgodnione koszty: ${valueOrPending(draft.otherCosts, "0 EUR netto")}.`, true),
      paragraph("2. Wszystkie kwoty są wyrażone w euro, o ile przy konkretnej pozycji nie wskazano inaczej."),
      paragraph("3. Podatek VAT zostanie rozliczony zgodnie z przepisami właściwymi dla konkretnej transakcji, z uwzględnieniem miejsca dostawy, miejsca przeznaczenia katamaranu, statusu Kupującego i spełnienia wymaganych warunków dokumentacyjnych. Umowa nie ustala automatycznie stawki VAT 0%, 23% ani 25%."),
      paragraph("4. W przypadku dostawy z Chorwacji do innego państwa członkowskiego Unii Europejskiej transakcja może zostać rozliczona bez chorwackiego VAT, jeżeli spełnione zostaną wszystkie wymagane prawem warunki, w szczególności dotyczące faktycznego przemieszczenia jednostki i dokumentacji."),
      paragraph("5. Dla nowej jednostki pływającej o długości przekraczającej 7,5 m stosuje się również szczególne unijne zasady dotyczące nowych środków transportu. Za nową uważa się jednostkę dostarczoną w ciągu trzech miesięcy od pierwszego dopuszczenia do użytku lub taką, która przepłynęła nie więcej niż 100 godzin."),
      paragraph("6. Jeżeli miejscem dostawy i opodatkowania będzie Chorwacja, zostanie zastosowana właściwa chorwacka stawka VAT. Ostateczny sposób rozliczenia VAT zostanie wskazany na fakturze zgodnie ze stanem faktycznym i obowiązującymi przepisami."),

      section("§3 WARUNKI PŁATNOŚCI"),
      paragraph("1. Kupujący zapłaci cenę zgodnie z poniższym harmonogramem:"),
      { table: { headerRows: 1, widths: [125, "*", 130], body: [[{ text: "Etap", style: "tableHeader" }, { text: "Procent lub kwota", style: "tableHeader" }, { text: "Termin płatności", style: "tableHeader" }], ...paymentRows] }, layout: "lightHorizontalLines", margin: [0, 2, 0, 10] },
      paragraph("2. Płatności będą dokonywane przelewem na rachunek Sprzedawcy wskazany na fakturze lub dokumencie płatności. Za dzień zapłaty uważa się dzień uznania rachunku Sprzedawcy."),
      paragraph("3. Wydanie katamaranu nastąpi po zapłacie wszystkich kwot wymagalnych przed wydaniem, chyba że Strony pisemnie uzgodnią inaczej."),

      section("§4 TERMIN REALIZACJI I ODBIORU"),
      paragraph(`1. Planowany termin gotowości do odbioru: ${valueOrPending(draft.pickupDate)}.`),
      paragraph(`2. Planowane miejsce odbioru: ${valueOrPending(draft.pickupPlace)}.`),
      paragraph(`3. Miejsce docelowe wskazane przez Kupującego: ${valueOrPending(draft.destination)}.`),
      paragraph("4. Sprzedawca poinformuje Kupującego o gotowości jednostki. Terminy mogą ulec zmianie z przyczyn niezależnych od Sprzedawcy, w szczególności wskutek zmian harmonogramu producenta, opóźnień komponentów lub transportu, działań administracji albo siły wyższej. O przewidywanym istotnym opóźnieniu Sprzedawca poinformuje Kupującego bez zbędnej zwłoki."),

      section("§5 ODBIÓR KATAMARANU"),
      paragraph("1. Odbiór zostanie potwierdzony Protokołem Zdawczo-Odbiorczym podpisanym przez Strony lub ich upoważnionych przedstawicieli."),
      paragraph("2. Kupujący może dokonać oględzin oraz sprawdzić zgodność konfiguracji z umową i Załącznikiem nr 1. Braki, usterki lub niezgodności zostaną wpisane do protokołu."),
      paragraph("3. Drobne usterki, które nie uniemożliwiają bezpiecznego i normalnego korzystania z katamaranu, nie stanowią podstawy odmowy odbioru; zostaną usunięte w uzgodnionym terminie, z zachowaniem praw wynikających z właściwych przepisów i gwarancji."),
      paragraph("4. Wraz z katamaranem Kupujący otrzyma dokumentację producenta oraz dokumenty wymagane dla danej transakcji i dostępne na dzień wydania."),

      section("§6 PRZEJŚCIE WŁASNOŚCI I RYZYKA"),
      paragraph("1. Prawo własności przechodzi na Kupującego po zapłacie pełnej ceny i spełnieniu pozostałych warunków umowy, z zastrzeżeniem bezwzględnie obowiązujących przepisów."),
      paragraph("2. Moment przejścia ryzyka przypadkowej utraty lub uszkodzenia określa uzgodniony sposób i miejsce wydania oraz właściwe przepisy. Warunki transportu, odpowiedzialności i ubezpieczenia określa Załącznik nr 3."),

      section("§7 GWARANCJA SERWIS I STATUS KUPUJĄCEGO"),
      paragraph("1. Katamaran jest objęty gwarancją BALI CATAMARANS / CATANA GROUP. Urządzenia, silniki, generatory i elektronika mogą podlegać odrębnym gwarancjom ich producentów."),
      paragraph("2. Dokumentacja gwarancyjna zostanie przekazana w zakresie dostarczonym przez producentów."),
      paragraph(`3. ${consumerClause}`),

      section("§8 ZMIANY KONFIGURACJI"),
      paragraph("1. Po podpisaniu umowy zmiany konfiguracji wymagają akceptacji Sprzedawcy oraz, jeżeli jest to konieczne, producenta. Mogą powodować zmianę ceny i terminu realizacji."),
      paragraph("2. Każda zaakceptowana zmiana wpływająca na cenę lub istotne parametry zamówienia zostanie potwierdzona w formie dokumentowej lub pisemnym aneksem, zgodnie z właściwym prawem."),

      section("§9 REZYGNACJA ODSTĄPIENIE I ROZWIĄZANIE"),
      paragraph("1. Warunki rezygnacji, odstąpienia, rozwiązania umowy i zwrotu wpłat określają umowa, harmonogram płatności, warunki specjalne oraz bezwzględnie obowiązujące przepisy."),
      paragraph("2. Katamaran jest produkowany lub konfigurowany według indywidualnej specyfikacji Kupującego. Rozpoczęcie realizacji może wiązać się z kosztami i zobowiązaniami Sprzedawcy wobec producenta i dostawców."),
      paragraph(`3. ${draft.buyerType === "b2c" ? "Zakres i skutki ewentualnego prawa odstąpienia należy oceniać według sposobu zawarcia umowy, stopnia indywidualizacji katamaranu oraz bezwzględnie obowiązujących przepisów konsumenckich." : "Szczegółowe konsekwencje rezygnacji po rozpoczęciu realizacji wynikają z warunków specjalnych i uzgodnionego harmonogramu płatności."}`),

      section("§10 SIŁA WYŻSZA"),
      paragraph("1. Strony nie odpowiadają za niewykonanie lub opóźnienie w zakresie wynikającym z okoliczności pozostających poza ich uzasadnioną kontrolą, w tym katastrof naturalnych, wojny, działań władz, zamknięcia portów oraz poważnych zakłóceń produkcji lub transportu."),
      paragraph("2. Strona dotknięta takim zdarzeniem poinformuje drugą Stronę bez zbędnej zwłoki."),

      section("§11 PRAWO WŁAŚCIWE I SPORY"),
      paragraph(`1. ${lawClause}`),
      paragraph("2. Strony zobowiązują się w pierwszej kolejności dążyć do polubownego rozwiązania sporu."),

      section("§12 POSTANOWIENIA KOŃCOWE"),
      paragraph("1. Integralną część umowy stanowią: Załącznik nr 1 - Specyfikacja i konfiguracja katamaranu; Załącznik nr 2 - Harmonogram płatności; Załącznik nr 3 - Warunki dostawy i transportu; Załącznik nr 4 - Oferta handlowa wskazana w umowie."),
      paragraph("2. W razie rozbieżności pierwszeństwo ma podpisana umowa, chyba że Strony wyraźnie postanowią inaczej. Zmiany wymagają formy przewidzianej przez właściwe przepisy."),
      paragraph(`3. Umowę sporządzono w ${valueOrPending(draft.copies, "2")} jednobrzmiących egzemplarzach lub zawarto w formie elektronicznej, po jednym egzemplarzu dla każdej ze Stron.`),
      paragraph(`4. Warunki specjalne: ${specialTerms}`),
      paragraph("5. Kupujący potwierdza otrzymanie i zapoznanie się z treścią umowy oraz załącznikami przed podpisaniem."),
      { columns: [
        { width: "46%", stack: [{ text: "SPRZEDAWCA", style: "signatureTitle" }, { text: seller.name, bold: true }, { text: seller.representative }, { text: "\nPodpis: __________________________\n\nData: ____________________________", margin: [0, 18, 0, 0] }] },
        { width: "8%", text: "" },
        { width: "46%", stack: [{ text: "KUPUJĄCY", style: "signatureTitle" }, { text: buyerName || "Nie podano", bold: true }, { text: "\nPodpis: __________________________\n\nData: ____________________________", margin: [0, 18, 0, 0] }] },
      ], margin: [0, 18, 0, 12] },

      { text: "ZAŁĄCZNIK NR 1", style: "appendix", pageBreak: "before" },
      { text: "SPECYFIKACJA I KONFIGURACJA KATAMARANU", style: "appendixTitle" },
      { table: { headerRows: 1, widths: ["*", 120], body: [
        [{ text: "Pozycja", style: "tableHeader" }, { text: "Cena netto", style: "tableHeader", alignment: "right" }],
        [offer.model, { text: money(offer.basePrice), alignment: "right" }],
        [offer.excellenceName, { text: money(offer.excellencePrice), alignment: "right" }],
        ...equipmentRows.map(([label, price]) => [label, { text: price, alignment: "right" }]),
        [{ text: "CENA JACHTU I KONFIGURACJI NETTO", bold: true }, { text: money(offer.yachtNet), bold: true, alignment: "right" }],
        [{ text: "PRZYGOTOWANIE I DOSTAWA NETTO", bold: true }, { text: money(offer.deliveryNet), bold: true, alignment: "right" }],
        [{ text: "CENA UMOWNA NETTO", style: "totalLabel" }, { text: money(offer.totalNet), style: "totalValue", alignment: "right" }],
      ] }, layout: "lightHorizontalLines", margin: [0, 8, 0, 10] },
      paragraph(`Konfiguracja pochodzi z zaakceptowanej oferty ${offer.offerNumber} z dnia ${offer.offerDate}. VAT zostanie rozliczony zgodnie z §2 umowy; na etapie umowy nie jest naliczany automatycznie.`),

      { text: "ZAŁĄCZNIK NR 2", style: "appendix", pageBreak: "before" },
      { text: "HARMONOGRAM PŁATNOŚCI", style: "appendixTitle" },
      { table: { headerRows: 1, widths: [125, "*", 130], body: [[{ text: "Etap", style: "tableHeader" }, { text: "Procent lub kwota", style: "tableHeader" }, { text: "Termin płatności", style: "tableHeader" }], ...paymentRows.map((row) => [...row])] }, layout: "lightHorizontalLines", margin: [0, 8, 0, 12] },

      { text: "ZAŁĄCZNIK NR 3", style: "appendix", pageBreak: "before" },
      { text: "WARUNKI DOSTAWY I TRANSPORTU", style: "appendixTitle" },
      paragraph(`Planowany termin odbioru: ${valueOrPending(draft.pickupDate)}.`),
      paragraph(`Miejsce odbioru: ${valueOrPending(draft.pickupPlace)}.`),
      paragraph(`Miejsce docelowe: ${valueOrPending(draft.destination)}.`),
      paragraph(`Warunki specjalne związane z dostawą: ${specialTerms}`),

      { text: "ZAŁĄCZNIK NR 4", style: "appendix", pageBreak: "before" },
      { text: "OFERTA HANDLOWA", style: "appendixTitle" },
      paragraph(`Integralnym dokumentem referencyjnym jest zaakceptowana oferta handlowa nr ${offer.offerNumber} z dnia ${offer.offerDate}, dotycząca modelu ${offer.model} w wersji ${offer.version}, o cenie ofertowej netto ${money(offer.totalNet)}.`),
    ],
    styles: {
      brand: { fontSize: 10, bold: true, color: "#a77928", characterSpacing: 1.5 },
      title: { fontSize: 22, bold: true, color: "#10223f", margin: [0, 12, 0, 0] },
      label: { fontSize: 7, color: "#687489", characterSpacing: 1 },
      buyerBadge: { fontSize: 8, bold: true, color: "#8d6a2d" },
      section: { fontSize: 12, bold: true, color: "#10223f", margin: [0, 14, 0, 8] },
      tableHeader: { bold: true, color: "#ffffff", fillColor: "#10223f", margin: [4, 5, 4, 5] },
      signatureTitle: { fontSize: 8, bold: true, color: "#8d6a2d", margin: [0, 0, 0, 5] },
      appendix: { fontSize: 9, bold: true, color: "#a77928", characterSpacing: 1.2, margin: [0, 0, 0, 8] },
      appendixTitle: { fontSize: 18, bold: true, color: "#10223f", margin: [0, 0, 0, 14] },
      totalLabel: { bold: true, color: "#ffffff", fillColor: "#10223f", margin: [4, 7, 4, 7] },
      totalValue: { bold: true, color: "#ffffff", fillColor: "#10223f", fontSize: 11, margin: [4, 6, 4, 6] },
    },
  };
  return definition as unknown as TDocumentDefinitions;
}
