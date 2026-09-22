// ozellik-listesi.md dosyasını Word belgesine çevirir.
//
//   npm install docx
//   node arac/md-to-docx.mjs ozellik-listesi.md Capproje-Ozellik-Listesi-ve-Teklif-Sartnamesi.docx
//
// DİKKAT: Word belgesi elle düzenlendiyse bu betiği yeniden çalıştırmak o
// düzenlemeleri siler. Düzenleme Word tarafında sürdürülecekse belgenin
// kendisi kaynak olur ve bu betik bir daha kullanılmaz.

import { readFileSync, writeFileSync } from "node:fs";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, LevelFormat, PageNumber,
  Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TabStopType, TextRun, WidthType,
  TableOfContents, PageBreak,
} from "docx";

const KAYNAK = process.argv[2];
const HEDEF = process.argv[3];
const source = readFileSync(KAYNAK, "utf8");

const YESIL = "1F4A38";
const KOYU = "23302B";
const GRI = "6B7772";
const CIZGI = "C9D2CC";
const BASLIK_ZEMIN = "E9F0EB";
const GOVDE = "Calibri";

const KENAR = 1100;
const ICERIK = 11906 - KENAR * 2;

// --- Satır içi biçimlendirme: **kalın**, *eğik*, `kod` -------------------
function runs(text, base = {}) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(new TextRun({ ...base, text: text.slice(last, match.index) }));
    const token = match[0];
    if (token.startsWith("**")) parts.push(new TextRun({ ...base, text: token.slice(2, -2), bold: true }));
    else if (token.startsWith("`")) parts.push(new TextRun({ ...base, text: token.slice(1, -1), font: "Consolas" }));
    else parts.push(new TextRun({ ...base, text: token.slice(1, -1), italics: true }));
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(new TextRun({ ...base, text: text.slice(last) }));
  return parts.length ? parts : [new TextRun({ ...base, text: "" })];
}

const duz = (text) => text.replace(/\*\*|\*|`/g, "");

// --- Tablo sütun genişlikleri -------------------------------------------
function sutunGenislikleri(rows, total) {
  const columns = rows[0].length;
  // En uzun tek kelime sığmalıdır: aksi hâlde Word kelimeyi hecelere bölerek
  // "Ana / Say / fa" gibi okunmaz sütunlar üretiyor. 9 punto Calibri'de bir
  // karakter yaklaşık 105 dxa; 280 dxa da hücre iç boşluğu payıdır.
  const asgari = [];
  const agirlik = [];
  for (let c = 0; c < columns; c++) {
    let enUzunKelime = 1;
    let toplamUzunluk = 0;
    for (const row of rows) {
      const metin = duz(row[c] || "");
      for (const kelime of metin.split(/\s+/)) enUzunKelime = Math.max(enUzunKelime, kelime.length);
      toplamUzunluk += metin.length;
    }
    asgari.push(Math.min(Math.round((total / columns) * 1.8), Math.max(700, enUzunKelime * 105 + 280)));
    // Üssü 1'in altında tutmak, çok uzun bir açıklama sütununun yanındaki kısa
    // sütunları ezmesini engeller.
    agirlik.push(Math.pow(Math.max(1, toplamUzunluk / rows.length), 0.62));
  }
  const agirlikToplami = agirlik.reduce((a, b) => a + b, 0);
  let widths = agirlik.map((w) => Math.round((total * w) / agirlikToplami));

  // Asgarinin altında kalan sütunlar yükseltilir, fark payı olan sütunlardan
  // payları oranında düşülür.
  const eksik = widths.map((w, c) => Math.max(0, asgari[c] - w));
  const toplamEksik = eksik.reduce((a, b) => a + b, 0);
  if (toplamEksik > 0) {
    const pay = widths.map((w, c) => Math.max(0, w - asgari[c]));
    const toplamPay = pay.reduce((a, b) => a + b, 0);
    widths = widths.map((w, c) => toplamPay > 0
      ? Math.round(w + eksik[c] - (pay[c] / toplamPay) * toplamEksik)
      : Math.round(total / columns));
  }
  const fark = widths.reduce((a, b) => a + b, 0) - total;
  const enGenis = widths.indexOf(Math.max(...widths));
  widths[enGenis] -= fark;
  return widths;
}

const kenarlik = { style: BorderStyle.SINGLE, size: 4, color: CIZGI };
const tabloKenarlari = { top: kenarlik, bottom: kenarlik, left: kenarlik, right: kenarlik, insideHorizontal: kenarlik, insideVertical: kenarlik };

function hucre(text, { width, header = false, first = false }) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: BASLIK_ZEMIN, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({
      style: header ? "TabloBasligi" : "TabloMetni",
      children: runs(text, header ? { bold: true } : {}),
      alignment: first && /^\d+$|^—$/.test(duz(text).trim()) ? AlignmentType.CENTER : AlignmentType.LEFT,
    })],
  });
}

function tablo(rows) {
  const basliksiz = rows[0].every((cell) => !duz(cell).trim());
  const veri = basliksiz ? rows.slice(1) : rows;
  const widths = sutunGenislikleri(veri, ICERIK);
  return new Table({
    columnWidths: widths,
    width: { size: ICERIK, type: WidthType.DXA },
    borders: tabloKenarlari,
    rows: veri.map((row, index) => new TableRow({
      tableHeader: !basliksiz && index === 0,
      children: row.map((cell, column) => hucre(cell, { width: widths[column], header: !basliksiz && index === 0, first: column === 0 })),
    })),
  });
}

// --- Markdown ayrıştırma -------------------------------------------------
const lines = source.split("\n");
const blocks = [];
let index = 0;
while (index < lines.length) {
  const line = lines[index];
  if (!line.trim()) { index += 1; continue; }
  if (/^\|/.test(line)) {
    const rows = [];
    while (index < lines.length && /^\|/.test(lines[index])) {
      const cells = lines[index].replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
      if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
      index += 1;
    }
    blocks.push({ type: "table", rows });
    continue;
  }
  const heading = /^(#{1,4})\s+(.*)$/.exec(line);
  if (heading) { blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() }); index += 1; continue; }
  if (/^---+\s*$/.test(line)) { blocks.push({ type: "rule" }); index += 1; continue; }
  if (/^>\s?/.test(line)) {
    const parts = [];
    while (index < lines.length && /^>\s?/.test(lines[index])) { parts.push(lines[index].replace(/^>\s?/, "")); index += 1; }
    blocks.push({ type: "quote", text: parts.join(" ").trim() });
    continue;
  }
  if (/^[-*]\s+/.test(line)) {
    const items = [];
    while (index < lines.length && /^[-*]\s+/.test(lines[index])) { items.push(lines[index].replace(/^[-*]\s+/, "").trim()); index += 1; }
    blocks.push({ type: "bullets", items });
    continue;
  }
  if (/^\d+\.\s+/.test(line)) {
    const items = [];
    while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
      const item = /^(\d+)\.\s+(.*)$/.exec(lines[index]);
      items.push({ number: item[1], text: item[2].trim() });
      index += 1;
    }
    blocks.push({ type: "numbers", items });
    continue;
  }
  const parts = [];
  while (index < lines.length && lines[index].trim() && !/^(\||#{1,4}\s|---+\s*$|>|[-*]\s|\d+\.\s)/.test(lines[index])) {
    parts.push(lines[index].trim());
    index += 1;
  }
  // Art arda gelen ve her biri kalın bir etiketle başlayan satırlar (Ek-1,
  // Ek-2…) sarılmış tek bir cümle değil, ayrı maddelerdir; birleştirilmemeli.
  if (parts.length > 1 && parts.every((part) => part.startsWith("**"))) {
    for (const part of parts) blocks.push({ type: "paragraph", text: part });
  } else {
    blocks.push({ type: "paragraph", text: parts.join(" ") });
  }
}

// --- Word öğelerine dönüştürme ------------------------------------------
const children = [];
let basligiGecti = 0;

function paragraf(text) {
  return new Paragraph({ style: "Normal", children: runs(text) });
}

for (const block of blocks) {
  if (block.type === "heading") {
    basligiGecti += 1;
    if (block.level === 1) {
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: runs(block.text) }));
      continue;
    }
    if (basligiGecti === 2 && block.level === 2) {
      children.push(new Paragraph({ style: "AltBaslik", children: runs(block.text) }));
      continue;
    }
    children.push(new Paragraph({
      heading: block.level === 2 ? HeadingLevel.HEADING_1 : block.level === 3 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
      children: runs(block.text),
    }));
    continue;
  }
  if (block.type === "table") { children.push(tablo(block.rows)); children.push(new Paragraph({ style: "Normal", spacing: { after: 170 }, children: [] })); continue; }
  if (block.type === "rule") { continue; }
  if (block.type === "quote") {
    children.push(new Paragraph({
      spacing: { before: 60, after: 200, line: 276 },
      indent: { left: 200, right: 200 },
      shading: { type: ShadingType.CLEAR, fill: "F4F7F4", color: "auto" },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: YESIL, space: 12 } },
      style: "Not",
      children: runs(block.text),
    }));
    continue;
  }
  if (block.type === "bullets") {
    block.items.forEach((item, position) => children.push(new Paragraph({
      numbering: { reference: "madde", level: 0 },
      spacing: { before: position === 0 ? 40 : 0, after: position === block.items.length - 1 ? 150 : 40, line: 276 },
      children: runs(item),
    })));
    continue;
  }
  if (block.type === "numbers") {
    // Numaralar kaynaktaki hâliyle yazılır: belgenin başka yerleri bu numaralara
    // atıf yapıyor, Word'ün kendi sayacı yeniden numaralandırırsa atıflar kayar.
    block.items.forEach((item, position) => children.push(new Paragraph({
      spacing: { before: position === 0 ? 40 : 0, after: position === block.items.length - 1 ? 150 : 40, line: 276 },
      style: "Normal",
      indent: { left: 420, hanging: 420 },
      tabStops: [{ type: TabStopType.LEFT, position: 420 }],
      children: [new TextRun({ text: `${item.number}.`, bold: true, color: YESIL }), new TextRun({ text: "\t" }), ...runs(item.text)],
    })));
    continue;
  }
  children.push(paragraf(block.text));
}

// İçindekiler kapak sayfasından sonra gelir: başlık, alt başlık ve künye
// tablosu ilk sayfada kalsın, dizin kendi sayfasında başlasın.
const kunyeSonu = children.findIndex((child) => child instanceof Table);
children.splice(kunyeSonu === -1 ? 2 : kunyeSonu + 2, 0,
  new Paragraph({ style: "Normal", children: [new PageBreak()] }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs("İçindekiler") }),
  new TableOfContents("İçindekiler", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ style: "Normal", children: [new PageBreak()] }),
);

const belge = new Document({
  creator: "Capproje",
  title: "Yazılım Özellik Listesi ve Teklif Şartnamesi",
  description: "Orman ürünleri / özel üretim ahşap işletmesi için yazılım teklif şartnamesi",
  features: { updateFields: true },
  // Biçim, satır içine değil stillere yazılır: teklifi alan firma yazı tipini
  // ya da başlık rengini Word'ün stil panelinden tek yerden değiştirebilsin.
  styles: {
    default: {
      document: { run: { font: GOVDE, size: 21, color: KOYU }, paragraph: { spacing: { after: 130, line: 276 } } },
      title: { run: { font: GOVDE, size: 40, bold: true, color: YESIL }, paragraph: { spacing: { before: 0, after: 90 } } },
      heading1: { run: { font: GOVDE, size: 28, bold: true, color: YESIL }, paragraph: { spacing: { before: 400, after: 170 }, keepNext: true, outlineLevel: 0 } },
      heading2: { run: { font: GOVDE, size: 23, bold: true, color: KOYU }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 1 } },
      heading3: { run: { font: GOVDE, size: 21, bold: true, color: KOYU }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 2 } },
    },
    paragraphStyles: [
      {
        id: "Normal", name: "Normal", quickFormat: true,
        run: { font: GOVDE, size: 21, color: KOYU },
        paragraph: { spacing: { after: 130, line: 276 } },
      },
      {
        id: "AltBaslik", name: "Alt Baslik", basedOn: "Normal", next: "Normal",
        run: { font: GOVDE, size: 26, color: GRI },
        paragraph: { spacing: { before: 0, after: 380 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: CIZGI, space: 10 } } },
      },
      {
        id: "TabloMetni", name: "Tablo Metni", basedOn: "Normal", next: "Normal",
        run: { font: GOVDE, size: 18, color: KOYU },
        paragraph: { spacing: { before: 0, after: 0, line: 250 } },
      },
      {
        id: "TabloBasligi", name: "Tablo Basligi", basedOn: "TabloMetni", next: "TabloMetni",
        run: { font: GOVDE, size: 18, bold: true, color: YESIL },
      },
      {
        id: "Not", name: "Not", basedOn: "Normal", next: "Normal",
        run: { font: GOVDE, size: 20, color: KOYU },
        paragraph: { spacing: { before: 60, after: 200, line: 276 }, indent: { left: 200, right: 200 } },
      },
    ],
  },
  numbering: {
    config: [{
      reference: "madde",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 200 } }, run: { color: YESIL } },
      }],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 1300, bottom: 1200, left: KENAR, right: KENAR } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 90 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: CIZGI, space: 6 } },
          children: [new TextRun({ text: "Yazılım Özellik Listesi ve Teklif Şartnamesi", size: 15, color: GRI, font: GOVDE })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: ["Sayfa ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 15, color: GRI, font: GOVDE })],
        })],
      }),
    },
    children,
  }],
});

writeFileSync(HEDEF, await Packer.toBuffer(belge));
console.log(`${HEDEF} yazıldı · ${blocks.length} blok, ${blocks.filter((b) => b.type === "table").length} tablo`);
