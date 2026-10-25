import { PDFDocument } from "pdf-lib";
import { buildVisitPrepPdf } from "../lib/visitPrepPdf";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=";
describe("combined visit PDF", () => {
  let create;
  beforeEach(() => {
    const original = document.createElement.bind(document);
    create = jest.spyOn(document, "createElement").mockImplementation((tag) => tag === "canvas" ? {
      getContext: () => ({ fillRect: jest.fn(), fillText: jest.fn(), measureText: (text) => ({ width: text.length * 14 }) }),
      toDataURL: () => `data:image/png;base64,${PNG}`,
    } : original(tag));
    global.fetch = jest.fn();
  });
  afterEach(() => create.mockRestore());
  const options = { name: "Patient", sections: [["Symptoms", "Headache"]], documents: [], downloadUrl: (id) => `/documents/${id}` };

  test("appends every original PDF page and an image after the summary", async () => {
    const source = await PDFDocument.create();
    source.addPage([300, 400]); source.addPage([400, 500]);
    const pdfBytes = await source.save();
    const pngBytes = Uint8Array.from(atob(PNG), (character) => character.charCodeAt(0));
    global.fetch.mockImplementation(async (url) => ({ ok: true, arrayBuffer: async () => url.endsWith("pdf") ? pdfBytes : pngBytes }));
    const bytes = await buildVisitPrepPdf({ ...options, documents: [{ id: "pdf", filename: "scan.pdf", mimeType: "application/pdf" }, { id: "image", filename: "lab.png", mimeType: "image/png" }] });
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBe(4);
    expect(result.getPage(1).getSize()).toEqual({ width: 300, height: 400 });
    expect(result.getPage(2).getSize()).toEqual({ width: 400, height: 500 });
    expect(result.getPage(3).node.Resources().lookupMaybe).toBeDefined();
  });

  test("paginates long summaries", async () => {
    const bytes = await buildVisitPrepPdf({ ...options, sections: [["History", "A symptom\n".repeat(100)]] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  });

  test.each(["scan.dcm", "broken.pdf"])("rejects unsupported or corrupt attachment %s", async (filename) => {
    global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]) });
    await expect(buildVisitPrepPdf({ ...options, documents: [{ id: "bad", filename }] })).rejects.toThrow(`Could not include ${filename}`);
  });
});
