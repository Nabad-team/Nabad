const { logEvent, errorDetails } = require("../logger");

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_PDF_PAGES = 25;
const MAX_REPORT_TEXT = 30000;
const MAX_DOCX_XML_BYTES = 2 * 1024 * 1024;
// Count letters and digits rather than layout whitespace. A completely blank or
// image-only page usually has zero; short table fragments remain "sparse" so
// they are not mistaken for fully unreadable pages.
const MIN_READABLE_PAGE_CHARS = 5;
const MIN_SUBSTANTIAL_PAGE_CHARS = 30;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TEXT_TYPES = new Set(["text/plain", "text/csv", "application/vnd.ms-excel"]);

class ReportInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ReportInputError";
    this.status = status;
  }
}

function decodeUpload(file) {
  if (!file || typeof file !== "object") throw new ReportInputError("Choose a PDF or a clear photo of a written test report.");
  const { mimeType, data, extension } = file;
  if (typeof mimeType !== "string" || typeof data !== "string" || data.length === 0) {
    throw new ReportInputError("The selected file could not be read. Please choose it again.");
  }
  if (data.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    throw new ReportInputError("The file is too large or could not be read. Choose a file under 3 MB.", 413);
  }
  const buffer = Buffer.from(data, "base64");
  if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) throw new ReportInputError("Choose a file under 3 MB.", 413);
  const safeExtension = typeof extension === "string" ? extension.toLowerCase().replace(/^\./, "") : "";
  return { mimeType: mimeType.toLowerCase(), extension: safeExtension, buffer };
}

function decodeXml(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, name) => {
    const key = name.toLowerCase();
    if (key === "amp") return "&";
    if (key === "lt") return "<";
    if (key === "gt") return ">";
    if (key === "quot") return '"';
    if (key === "apos") return "'";
    const code = key.startsWith("#x") ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
  });
}

function xmlToText(xml) {
  return decodeXml(xml
    .replace(/<w:tab\b[^>]*\/?\s*>/g, "\t")
    .replace(/<w:br\b[^>]*\/?\s*>/g, "\n")
    .replace(/<\/w:p\s*>/g, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function extractDocxText(buffer) {
  return new Promise((resolve, reject) => {
    const yauzl = require("yauzl");
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (openError, zip) => {
      if (openError || !zip) return reject(new ReportInputError("We could not open this Word document. Save it as DOCX or PDF and try again."));
      let entryCount = 0;
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(error);
      };
      zip.on("error", () => fail(new ReportInputError("We could not read this Word document.")));
      zip.on("entry", (entry) => {
        entryCount += 1;
        if (entryCount > 1000) return fail(new ReportInputError("This Word document contains too many parts."));
        if (entry.fileName !== "word/document.xml") return zip.readEntry();
        if (entry.uncompressedSize > MAX_DOCX_XML_BYTES) return fail(new ReportInputError("This Word document is too large to read safely."));
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail(new ReportInputError("We could not read the text in this Word document."));
          const chunks = [];
          let length = 0;
          stream.on("data", (chunk) => {
            length += chunk.length;
            if (length > MAX_DOCX_XML_BYTES) return fail(new ReportInputError("This Word document is too large to read safely."));
            chunks.push(chunk);
          });
          stream.on("error", () => fail(new ReportInputError("We could not read the text in this Word document.")));
          stream.on("end", () => {
            if (settled) return;
            settled = true;
            zip.close();
            const text = xmlToText(Buffer.concat(chunks).toString("utf8")).slice(0, MAX_REPORT_TEXT);
            if (text.length < 40) return reject(new ReportInputError("This Word document has no readable report text. Try a searchable PDF or clear photo instead.", 422));
            resolve({ kind: "text", text, partial: text.length >= MAX_REPORT_TEXT });
          });
        });
      });
      zip.on("end", () => {
        if (!settled) fail(new ReportInputError("This Word document does not contain a readable report."));
      });
      zip.readEntry();
    });
  });
}

function extractPlainText(buffer, extension) {
  if (buffer.includes(0)) throw new ReportInputError("Use a UTF-8 text or CSV file. This encoding could not be read.");
  let text = buffer.toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (text.includes("\uFFFD")) throw new ReportInputError("Use a UTF-8 text or CSV file. This encoding could not be read.");
  const partial = text.length > MAX_REPORT_TEXT;
  text = text.slice(0, MAX_REPORT_TEXT).trim();
  if (text.length < 40) throw new ReportInputError("This file does not contain enough readable report text.", 422);
  return { kind: "text", text, partial: partial || extension === "csv" && text.split("\n").length > 1000 };
}

function assessPdfCoverage(pageTexts, pageLabels = null, { truncated = false, expectedPageCount = pageTexts.length } = {}) {
  const pages = pageTexts.map((text, index) => {
    const readableChars = String(text || "").replace(/[^\p{L}\p{N}]/gu, "").length;
    const status = readableChars < MIN_READABLE_PAGE_CHARS ? "unreadable" : readableChars < MIN_SUBSTANTIAL_PAGE_CHARS ? "sparse" : "readable";
    return { pageNumber: index + 1, label: pageLabels?.[index] || null, readableChars, status };
  });
  const unreadablePages = pages.filter((page) => page.status === "unreadable").map((page) => page.pageNumber);
  const sparsePages = pages.filter((page) => page.status === "sparse").map((page) => page.pageNumber);
  const issues = [];
  if (unreadablePages.length) issues.push(`No useful selectable text was extracted from page${unreadablePages.length === 1 ? "" : "s"} ${unreadablePages.join(", ")}. Those pages may be blank, scanned, or unreadable.`);
  if (pages.length > 1 && sparsePages.length && sparsePages.length / pages.length >= 0.25) issues.push(`Very little selectable text was extracted from page${sparsePages.length === 1 ? "" : "s"} ${sparsePages.join(", ")}; table rows or findings may be incomplete.`);
  const numericLabels = Array.isArray(pageLabels) && pageLabels.length === pages.length && pageLabels.every((label) => /^\d+$/.test(label))
    ? pageLabels.map(Number) : null;
  if (numericLabels && numericLabels.some((label, index) => index > 0 && label !== numericLabels[index - 1] + 1)) {
    issues.push("The PDF page labels are not sequential; one or more pages may be missing or duplicated.");
  }
  if (truncated) issues.push("The extracted report text exceeded the analysis limit, so later content was not processed.");
  return {
    pageCount: expectedPageCount,
    processedPages: pages.length,
    readablePages: pages.filter((page) => page.status === "readable").length,
    sparsePages,
    unreadablePages,
    pages,
    issues,
    status: issues.length ? "uncertain" : "complete",
  };
}

async function extractPdfText(buffer) {
  if (buffer.length < 8 || buffer.toString("ascii", 0, 5) !== "%PDF-") {
    throw new ReportInputError("This file does not appear to be a valid PDF.");
  }
  let pdfjs;
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (error) {
    // Usually pdfjs-dist missing from node_modules (ERR_MODULE_NOT_FOUND: an install older than package.json).
    // Logged so the 503 below doesn't hide why; only the error's type and code.
    logEvent("pdf_reader_unavailable", errorDetails(error));
    throw new ReportInputError("PDF reading is not configured on this server. Please try a clear photo of the written report.", 503);
  }
  let loadingTask;
  let pdf;
  try {
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true });
    pdf = await loadingTask.promise;
  } catch {
    throw new ReportInputError("We could not open this PDF. Try a clear photo or another copy of the report.");
  }
  const pageCount = pdf.numPages;
  if (!pageCount || pageCount > MAX_PDF_PAGES) {
    await loadingTask.destroy();
    throw new ReportInputError(`Choose a PDF with ${MAX_PDF_PAGES} pages or fewer.`);
  }
  const pages = [];
  let pageLabels = null;
  try {
    pageLabels = await pdf.getPageLabels().catch(() => null);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).filter(Boolean).join(" "));
      if (pages.join("\n").length > MAX_REPORT_TEXT) break;
    }
  } catch {
    throw new ReportInputError("We could not read the text in this PDF. Try a searchable PDF or a clear photo of the written report.", 422);
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
  const fullText = pages.join("\n").replace(/\s+/g, " ").trim();
  const truncated = fullText.length > MAX_REPORT_TEXT || pages.length < pageCount;
  const extraction = assessPdfCoverage(pages, pageLabels, { truncated, expectedPageCount: pageCount });
  const partial = truncated || extraction.status !== "complete";
  const text = fullText.slice(0, MAX_REPORT_TEXT);
  if (text.length < 40) {
    throw new ReportInputError("This PDF has no usable selectable text and may be a scanned document. Upload a clear photo of the written report or a searchable PDF instead.", 422);
  }
  return { kind: "text", text, partial, extraction };
}

async function extractReport(file) {
  const { mimeType, extension, buffer } = decodeUpload(file);
  if (mimeType === "application/pdf") return extractPdfText(buffer);
  if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return extractDocxText(buffer);
  if (extension === "txt" || extension === "csv" || TEXT_TYPES.has(mimeType)) return extractPlainText(buffer, extension);
  if (!IMAGE_TYPES.has(mimeType)) throw new ReportInputError("Use a PDF, JPG, PNG, or WebP image of a written report.");
  const signatures = {
    "image/jpeg": buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    "image/png": buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/webp": buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP",
  };
  if (!signatures[mimeType]) throw new ReportInputError("The file contents do not match the selected image type.");
  return { kind: "image", mimeType, dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}` };
}

module.exports = { extractReport, decodeUpload, extractPdfText, extractDocxText, extractPlainText, assessPdfCoverage, ReportInputError, MAX_FILE_BYTES, MAX_PDF_PAGES, MAX_REPORT_TEXT };
