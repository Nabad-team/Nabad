const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("An attached document could not be read."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Embed original files so the exported sheet can be shared without a Nabad session.
export async function exportVisitPrep({ name, sections, documents, downloadUrl }) {
  const attachments = [];
  for (const document of documents) {
    const response = await fetch(downloadUrl(document.id), { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error(`Could not attach ${document.filename}. Please reload the documents and try again.`);
    const encoded = await dataUrl(new Blob([await response.arrayBuffer()], { type: "application/octet-stream" }));
    attachments.push(`<li><a download="${escapeHtml(document.filename)}" href="${escapeHtml(encoded)}">${escapeHtml(document.filename)}</a></li>`);
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Visit preparation — ${escapeHtml(name)}</title><style>body{font:16px/1.5 system-ui;max-width:800px;margin:2rem auto;padding:1rem}p{white-space:pre-wrap;overflow-wrap:anywhere}section{margin:2rem 0}h2{break-after:avoid}@media print{body{margin:0}}</style></head><body><h1>Visit preparation</h1><p>${escapeHtml(name)}</p>${sections.map(([title, text]) => `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></section>`).join("")}${attachments.length ? `<section><h2>Attached medical documents</h2><p>Open the links to save the original files. These files are embedded in this sheet. Printing this sheet does not print the original documents.</p><ul>${attachments.join("")}</ul></section>` : ""}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = "visit-preparation.html";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
