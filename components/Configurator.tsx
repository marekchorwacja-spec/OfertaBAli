"use client";

import { useState } from "react";
import catalog from "@/data/models.json";

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

const models = catalog.models as Model[];
const offerSeed = Date.now();
const steps = ["Model", "Wersja", "Wyposażenie", "Podsumowanie", "Klient", "Oferta"];
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

function download(name: string, content: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function Configurator() {
  const [step, setStep] = useState(0);
  const [modelId, setModelId] = useState(models[0].id);
  const model = models.find((item) => item.id === modelId) ?? models[0];
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [history, setHistory] = useState<{ number: string; model: string; customer: string; total: number; date: string }[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem("odisej-offers");
    return saved ? JSON.parse(saved) : [];
  });
  const [toast, setToast] = useState("");

  const allOptions = [...model.options, ...model.delivery];
  const categories = ["Wszystkie", ...new Set(allOptions.map((item) => displayCategory(item.category)))];
  const filteredOptions = allOptions.filter((item) => {
    const matchesText = `${item.description} ${item.category}`.toLocaleLowerCase("pl").includes(search.toLocaleLowerCase("pl"));
    const matchesCategory = category === "Wszystkie" || displayCategory(item.category) === category;
    const matchesPrice = item.price === null || item.price <= maxPrice;
    return matchesText && matchesCategory && matchesPrice;
  });
  const chosenOptions = allOptions.filter((item) => (selected[item.id] ?? item.defaultQuantity) > 0);
  const equipmentNet = chosenOptions.reduce((sum, item) => sum + (item.price ?? 0) * (selected[item.id] ?? item.defaultQuantity), 0);
  const subtotal = version.basePrice + model.excellencePackage.price + equipmentNet;
  const discountValue = subtotal * Math.min(Math.max(discount, 0), 100) / 100;
  const net = subtotal - discountValue;
  const vatValue = net * Math.min(Math.max(vat, 0), 100) / 100;
  const gross = net + vatValue;
  const offerNumber = `OY/${new Date(offerSeed).getFullYear()}/${String(offerSeed).slice(-6)}`;

  const selectModel = (id: string) => {
    const next = models.find((item) => item.id === id) ?? models[0];
    setModelId(id);
    setVersionId(next.versions[0].id);
    setSelected({});
    setSearch("");
    setCategory("Wszystkie");
    setStep(2);
  };
  const toggleOption = (item: Option) => setSelected((current) => ({
    ...current,
    [item.id]: (current[item.id] ?? item.defaultQuantity) > 0 ? 0 : 1,
  }));
  const updateCustomer = (field: keyof Customer, value: string) => setCustomer((current) => ({ ...current, [field]: value }));
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const offerPayload = () => ({
    offerNumber,
    date: new Date().toISOString(),
    priceList: catalog.priceList,
    currency: catalog.currency,
    model: model.name,
    version,
    excellencePackage: model.excellencePackage,
    selectedOptions: chosenOptions.map((item) => ({ ...item, quantity: selected[item.id] ?? item.defaultQuantity })),
    calculation: { basePrice: version.basePrice, excellence: model.excellencePackage.price, equipmentNet, subtotal, discountPercent: discount, discountValue, net, vatPercent: vat, vatValue, gross },
    customer,
  });
  const offerHtml = () => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${offerNumber}</title><style>body{font-family:Arial;color:#10223f;max-width:900px;margin:40px auto;line-height:1.5}h1{font-family:Georgia;font-size:42px}.gold{color:#a77928}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}.total{font-size:24px;font-weight:700}.muted{color:#687489}img{width:120px}</style></head><body><p class="gold">ODISEJ YACHTING · OFERTA ${offerNumber}</p><h1>${model.name}</h1><p>${version.name}</p><p class="muted">${customer.firstName} ${customer.lastName} · ${customer.company}</p>${chosenOptions.map((item) => `<div class="row"><span>${item.description}</span><strong>${item.price === null ? "Cena na zapytanie" : money(item.price)}</strong></div>`).join("")}<div class="row total"><span>Do zapłaty brutto</span><span>${money(gross)}</span></div><p>Oferta ważna po pisemnym potwierdzeniu przez Odisej Yacht Club.</p><img alt="Kod QR oferty" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(offerNumber)}"></body></html>`;
  const saveOffer = () => {
    const record = { number: offerNumber, model: model.name, customer: `${customer.firstName} ${customer.lastName}`.trim() || "Klient", total: gross, date: new Date().toLocaleDateString("pl-PL") };
    const next = [record, ...history.filter((item) => item.number !== record.number)].slice(0, 50);
    setHistory(next);
    localStorage.setItem("odisej-offers", JSON.stringify(next));
    showToast("Oferta zapisana w historii");
  };
  const exportJson = () => download(`${offerNumber.replaceAll("/", "-")}.json`, JSON.stringify(offerPayload(), null, 2), "application/json");
  const exportHtml = () => download(`${offerNumber.replaceAll("/", "-")}.html`, offerHtml(), "text/html");
  const printOffer = () => {
    saveOffer();
    const frame = window.open("", "_blank", "width=1000,height=800");
    if (!frame) return showToast("Zezwól przeglądarce na otwieranie okien");
    frame.document.write(offerHtml());
    frame.document.close();
    frame.setTimeout(() => frame.print(), 300);
  };
  const sendEmail = () => {
    saveOffer();
    const subject = encodeURIComponent(`Oferta ${offerNumber} – ${model.name}`);
    const body = encodeURIComponent(`Dzień dobry,\n\nw ofercie przesyłamy konfigurację ${model.name}.\nWartość brutto: ${money(gross)}.\nNumer oferty: ${offerNumber}.\n\nOdisej Yachting`);
    window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, "_self");
  };

  return (
    <main className={dark ? "app dark" : "app light"}>
      <header className="topbar">
        <button className="brand" onClick={() => setStep(0)} aria-label="Strona główna">
          <span className="brand-mark">OY</span><span><b>ODISEJ</b><small>YACHTING</small></span>
        </button>
        <nav>
          <button onClick={() => setCompareOpen(true)}>Porównaj <span className="count">{compareIds.length}</span></button>
          <button onClick={() => setAdminOpen(true)}>Panel administratora</button>
          <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Zmień motyw">{dark ? "☼" : "◐"}</button>
        </nav>
      </header>

      {step === 0 ? (
        <section className="hero">
          <div className="hero-art" aria-hidden="true"><div className="sun"/><div className="yacht"><i/><b/><span/></div><div className="water"/></div>
          <div className="hero-content">
            <p className="eyebrow">BALI CATAMARANS · CENNIK A-2026</p>
            <h1>Twoja podróż.<br/><em>Skonfigurowana.</em></h1>
            <p className="lead">Stwórz spersonalizowaną ofertę katamaranu BALI — od układu kabin po ostatni detal wyposażenia.</p>
            <button className="primary" onClick={() => setStep(1)}>Rozpocznij konfigurację <span>→</span></button>
            <div className="hero-stats"><div><strong>{models.length}</strong><span>modeli BALI</span></div><div><strong>{models.reduce((sum, item) => sum + item.versions.length, 0)}</strong><span>wersji kabinowych</span></div><div><strong>A-2026</strong><span>aktualny cennik</span></div></div>
          </div>
          <div className="scroll-cue">ODKRYJ KOLEKCJĘ <span>↓</span></div>
        </section>
      ) : (
        <>
          <section className="progress-wrap">
            <div className="progress-title"><button onClick={() => setStep(Math.max(1, step - 1))}>← Wstecz</button><span>KONFIGURATOR BALI A-2026</span><strong>{step} / 6</strong></div>
            <div className="progress-line">{steps.map((label, index) => <button key={label} className={step >= index + 1 ? "active" : ""} onClick={() => step > index + 1 && setStep(index + 1)}><i>{index + 1}</i><span>{label}</span></button>)}</div>
          </section>

          {step === 1 && <section className="content-stage"><SectionHead eyebrow="Krok 1" title="Wybierz swój model" text="Siedem charakterów. Jedna filozofia swobodnego życia na wodzie."/><div className="model-grid">{models.map((item, index) => <article className="model-card" key={item.id}><div className={`model-visual tone-${index}`}><span>{item.name.replace("BALI ", "")}</span><div className="mini-yacht"/></div><div className="model-body"><p>OD {money(Math.min(...item.versions.map((v) => v.basePrice)))}</p><h3>{item.name}</h3><span>{item.versions.length} {item.versions.length === 2 ? "wersje" : "wersji"} · {item.versions[0].standardEngines}</span><div><button className="primary small" onClick={() => selectModel(item.id)}>Wybierz</button><label className="compare-check"><input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => setCompareIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : ids.length < 3 ? [...ids, item.id] : ids)}/> Porównaj</label></div></div></article>)}</div></section>}

          {step === 2 && <section className="content-stage narrow"><SectionHead eyebrow="Krok 2" title={`Wersja kabinowa ${model.name}`} text={model.tagline}/><div className="version-list">{model.versions.map((item) => <button key={item.id} className={versionId === item.id ? "version-card selected" : "version-card"} onClick={() => setVersionId(item.id)}><i>{versionId === item.id ? "✓" : ""}</i><span><b>{item.name}</b><small>{item.standardEngines}</small></span><strong>{money(item.basePrice)}</strong></button>)}</div><div className="package-panel"><div><p>PAKIET FABRYCZNY</p><h3>{model.excellencePackage.name}</h3><span>{model.excellencePackage.included.length} pozycji wyposażenia w pakiecie</span></div><strong>{money(model.excellencePackage.price)}</strong><details><summary>Zobacz pełną specyfikację</summary><ul>{model.excellencePackage.included.map((item) => <li key={item.sourceRow}>{item.description}</li>)}</ul></details></div><StepFooter price={version.basePrice + model.excellencePackage.price} onNext={() => setStep(3)}/></section>}

          {step === 3 && <section className="content-stage equipment-stage"><SectionHead eyebrow="Krok 3" title="Wyposażenie dodatkowe" text={`${allOptions.length} pozycji z cennika ${model.name}. Wybierz to, co definiuje Twój styl podróżowania.`}/><div className="equipment-layout"><aside className="filters"><label>WYSZUKAJ<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="np. generator, Raymarine…"/></label><label>KATEGORIA<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>CENA DO <b>{money(maxPrice)}</b><input type="range" min="1000" max="250000" step="1000" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}/></label><button className="ghost" onClick={() => { setSearch(""); setCategory("Wszystkie"); setMaxPrice(250000); }}>Wyczyść filtry</button></aside><div className="option-list"><div className="results"><span>{filteredOptions.length} wyników</span><span>{chosenOptions.length} wybranych</span></div>{filteredOptions.map((item) => { const qty = selected[item.id] ?? item.defaultQuantity; return <article key={item.id} className={qty > 0 ? "option-card selected" : "option-card"} onClick={() => toggleOption(item)}><button aria-label={qty > 0 ? "Usuń opcję" : "Dodaj opcję"}>{qty > 0 ? "✓" : "+"}</button><div><p>{displayCategory(item.category)}</p><h4>{item.description}</h4>{item.note && <small>{item.note}</small>}</div><strong>{item.priceOnRequest || item.price === null ? "Cena na zapytanie" : `+ ${money(item.price)}`}</strong></article>})}</div><aside className="live-summary"><p>TWOJA KONFIGURACJA</p><h3>{model.name}</h3><span>{version.name}</span><dl><div><dt>Cena bazowa</dt><dd>{money(version.basePrice)}</dd></div><div><dt>Excellence</dt><dd>{money(model.excellencePackage.price)}</dd></div><div><dt>Opcje ({chosenOptions.length})</dt><dd>{money(equipmentNet)}</dd></div></dl><div className="summary-total"><span>RAZEM NETTO</span><strong>{money(subtotal)}</strong></div><button className="primary" onClick={() => setStep(4)}>Podsumowanie →</button></aside></div></section>}

          {step === 4 && <section className="content-stage narrow"><SectionHead eyebrow="Krok 4" title="Podsumowanie konfiguracji" text="Sprawdź ceny, ustaw warunki handlowe i przygotuj finalną kalkulację."/><div className="summary-layout"><div className="summary-sheet"><h3>{model.name}</h3><p>{version.name}</p><PriceRow label="Cena bazowa" value={version.basePrice}/><PriceRow label="Pakiet Excellence" value={model.excellencePackage.price}/>{chosenOptions.map((item) => <PriceRow key={item.id} label={item.description} value={item.price}/>)}</div><div className="calculation-card"><label>Rabat handlowy <span><input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(Number(e.target.value))}/>%</span></label><label>Stawka VAT <span><input type="number" min="0" max="100" value={vat} onChange={(e) => setVat(Number(e.target.value))}/>%</span></label><dl><div><dt>Suma przed rabatem</dt><dd>{money(subtotal)}</dd></div><div><dt>Rabat</dt><dd>− {money(discountValue)}</dd></div><div><dt>Netto po rabacie</dt><dd>{money(net)}</dd></div><div><dt>VAT</dt><dd>{money(vatValue)}</dd></div></dl><div className="grand-total"><span>DO ZAPŁATY BRUTTO</span><strong>{money(gross)}</strong></div></div></div><div className="export-strip"><button onClick={printOffer}>Druk / PDF</button><button onClick={exportHtml}>Eksport HTML</button><button onClick={exportJson}>Eksport JSON</button></div><StepFooter price={gross} gross onNext={() => setStep(5)}/></section>}

          {step === 5 && <section className="content-stage narrow"><SectionHead eyebrow="Krok 5" title="Dane klienta" text="Dane zostaną umieszczone na spersonalizowanej ofercie."/><form className="customer-form" onSubmit={(e) => { e.preventDefault(); setStep(6); }}><div className="field-grid"><Field label="Imię" required value={customer.firstName} onChange={(v) => updateCustomer("firstName", v)}/><Field label="Nazwisko" required value={customer.lastName} onChange={(v) => updateCustomer("lastName", v)}/><Field label="Firma" value={customer.company} onChange={(v) => updateCustomer("company", v)}/><Field label="Telefon" value={customer.phone} onChange={(v) => updateCustomer("phone", v)}/><Field label="E-mail" type="email" required value={customer.email} onChange={(v) => updateCustomer("email", v)}/><Field label="Kraj" value={customer.country} onChange={(v) => updateCustomer("country", v)}/><Field label="Port odbioru" value={customer.deliveryPort} onChange={(v) => updateCustomer("deliveryPort", v)}/><Field label="Nazwa jachtu" value={customer.yachtName} onChange={(v) => updateCustomer("yachtName", v)}/></div><label className="textarea-field">Uwagi<textarea rows={5} value={customer.notes} onChange={(e) => updateCustomer("notes", e.target.value)} placeholder="Termin odbioru, sposób finansowania, dodatkowe informacje…"/></label><button className="primary form-submit" type="submit">Przygotuj ofertę →</button></form></section>}

          {step === 6 && <section className="content-stage offer-ready"><div className="success-mark">✓</div><p className="eyebrow">OFERTA GOTOWA</p><h2>{model.name} czeka na swojego właściciela.</h2><p>Oferta <b>{offerNumber}</b> dla {customer.firstName} {customer.lastName} została przygotowana. Wybierz sposób przekazania dokumentu.</p><div className="offer-card"><div><span>WARTOŚĆ BRUTTO</span><strong>{money(gross)}</strong><small>{chosenOptions.length} opcji · {version.name}</small></div><div className="qr">OY<small>QR</small></div></div><div className="offer-actions"><button className="primary" onClick={sendEmail}>Wyślij e-mail</button><button onClick={printOffer}>Pobierz PDF</button><button onClick={exportHtml}>Pobierz HTML</button><button onClick={exportJson}>Pobierz JSON</button></div><button className="text-button" onClick={() => { setStep(1); setSelected({}); setCustomer(emptyCustomer); }}>Utwórz nową konfigurację</button></section>}
        </>
      )}

      {compareOpen && <Modal title="Porównanie modeli" onClose={() => setCompareOpen(false)}><div className="compare-picker">{models.map((item) => <label key={item.id}><input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => setCompareIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : ids.length < 3 ? [...ids, item.id] : ids)}/>{item.name}</label>)}</div>{compareIds.length ? <div className="compare-table"><div/><b>Cena od</b><b>Wersje</b><b>Silniki standardowe</b>{compareIds.map((id) => { const item = models.find((candidate) => candidate.id === id)!; return <div className="compare-column" key={id}><h3>{item.name}</h3><span>{money(Math.min(...item.versions.map((v) => v.basePrice)))}</span><span>{item.versions.length}</span><span>{item.versions[0].standardEngines}</span></div>})}</div> : <p className="empty">Wybierz maksymalnie trzy modele do porównania.</p>}</Modal>}
      {adminOpen && <Modal title="Panel administratora" onClose={() => setAdminOpen(false)}><div className="admin-kpis"><div><strong>{models.length}</strong><span>modeli</span></div><div><strong>{models.reduce((sum, item) => sum + item.options.length + item.delivery.length, 0)}</strong><span>pozycji cenowych</span></div><div><strong>{history.length}</strong><span>ofert lokalnych</span></div></div><div className="admin-actions"><label>Import nowego Excela<input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && showToast(`Wybrano ${e.target.files[0].name}. Import wymaga publikacji nowej wersji katalogu.`)}/></label><button onClick={() => download("katalog-bali-a-2026.json", JSON.stringify(catalog, null, 2), "application/json")}>Eksport danych katalogu</button></div><h3>Historia ofert</h3><div className="history-list">{history.length ? history.map((item) => <div key={item.number}><span><b>{item.number}</b><small>{item.customer} · {item.model}</small></span><strong>{money(item.total)}</strong><time>{item.date}</time></div>) : <p className="empty">Historia pojawi się po zapisaniu pierwszej oferty.</p>}</div><p className="admin-note">Ceny i modele są synchronizowane z katalogiem wygenerowanym z pliku Excel A-2026. Import nowego cennika powinien przejść walidację przed publikacją.</p></Modal>}
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
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={(e) => e.stopPropagation()}><header><p>ODISEJ YACHTING</p><h2>{title}</h2><button onClick={onClose}>×</button></header>{children}</section></div>;
}
