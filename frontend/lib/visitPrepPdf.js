import { PDFDocument } from "pdf-lib";

// Canvas uses the browser's fonts and shaping, including Arabic and other Unicode text.
async function summaryPages(pdf, name, sections) {
  const canvas = document.createElement("canvas");
  canvas.width = 1240; canvas.height = 1754;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the PDF. Please try another browser.");
  let y = 90;
  function clear() { context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "black"; y = 90; }
  async function flush() {
    const image = await pdf.embedPng(canvas.toDataURL("image/png"));
    pdf.addPage([595.28, 841.89]).drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
    clear();
  }
  clear();
  for (const [title, text] of [["Visit preparation", name], ...sections]) {
    for (const [value, bold] of [[title, true], [text, false]]) {
      context.font = `${bold ? "bold " : ""}${bold ? 32 : 25}px sans-serif`;
      for (const paragraph of String(value).split("\n")) {
        let line = "";
        // Break long unspaced strings as well as normal words without dropping characters.
        for (const word of paragraph.split(/(?<=\s)/u)) {
          if (line && context.measureText(line + word).width > 1060) {
            if (y > 1650) await flush();
            context.fillText(line, 90, y); y += 38; line = "";
          }
          for (const character of word) {
            if (context.measureText(line + character).width > 1060) {
              if (y > 1650) await flush();
              context.fillText(line, 90, y); y += 38; line = "";
            }
            line += character;
          }
        }
        if (y > 1650) await flush();
        context.fillText(line, 90, y); y += 38;
      }
      y += 16;
    }
    y += 20;
  }
  await flush();
}

async function webpAsPng(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

export async function buildVisitPrepPdf({ name, sections, documents, downloadUrl }) {
  const pdf = await PDFDocument.create();
  await summaryPages(pdf, name, [...sections, ...(documents.length ? [["Attached documents (appended in this order)", documents.map((item) => item.filename).join("\n")]] : [])]);
  for (const attachment of documents) {
    try {
      const response = await fetch(downloadUrl(attachment.id), { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Download failed");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const type = attachment.mimeType || response.headers?.get("content-type") || "";
      if (type === "application/pdf" || /\.pdf$/i.test(attachment.filename)) {
        const source = await PDFDocument.load(bytes);
        // Preserve filled form values when copying their pages.
        if (source.getForm().getFields().length) source.getForm().flatten();
        if (!source.getPageCount()) throw new Error("Empty PDF");
        for (const page of await pdf.copyPages(source, source.getPageIndices())) pdf.addPage(page);
      } else {
        let image;
        if (type === "image/png" || /\.png$/i.test(attachment.filename)) image = await pdf.embedPng(bytes);
        else if (type === "image/jpeg" || /\.jpe?g$/i.test(attachment.filename)) image = await pdf.embedJpg(bytes);
        else if (type === "image/webp" || /\.webp$/i.test(attachment.filename)) image = await pdf.embedPng(await webpAsPng(bytes));
        else throw new Error("Unsupported format");
        const size = image.scaleToFit(515, 762);
        pdf.addPage([595.28, 841.89]).drawImage(image, { x: (595.28 - size.width) / 2, y: (841.89 - size.height) / 2, ...size });
      }
    } catch {
      throw new Error(`Could not include ${attachment.filename} in the PDF. Use an unprotected PDF, JPG, PNG or WebP image, or use the HTML export for original files. No incomplete PDF was downloaded.`);
    }
  }
  return pdf.save();
}

export async function exportVisitPrepPdf(options) {
  const bytes = await buildVisitPrepPdf(options);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url; link.download = "visit-preparation.pdf"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
