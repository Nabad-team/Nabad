import { exportVisitPrep } from "../lib/visitPrepExport";

describe("self-contained visit sheet export", () => {
  let blob;
  let click;
  beforeEach(() => {
    URL.createObjectURL = jest.fn((value) => { blob = value; return "blob:sheet"; });
    URL.revokeObjectURL = jest.fn();
    click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    global.fetch = jest.fn();
  });
  afterEach(() => { click.mockRestore(); });
  const read = (value) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(value);
  });
  const options = { name: "Patient", sections: [["Symptoms", "Headache\nSince Monday"]], documents: [{ id: "xray", filename: 'scan"<script>.pdf' }], downloadUrl: (id) => `/documents/${id}` };

  test("includes the original file bytes and escapes user text", async () => {
    global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Uint8Array.from([37, 80, 68, 70, 45, 116, 101, 115, 116]).buffer });
    await exportVisitPrep({ ...options, name: "<script>alert(1)</script>" });
    const html = await read(blob);
    expect(html).toContain("data:application/octet-stream;base64,JVBERi10ZXN0");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Headache\nSince Monday");
    expect(html).not.toContain("<script>");
    expect(html).toContain("scan&quot;&lt;script&gt;.pdf");
    expect(global.fetch).toHaveBeenCalledWith("/documents/xray", { credentials: "include", cache: "no-store" });
    expect(click).toHaveBeenCalledTimes(1);
  });

  test("does not produce an incomplete sheet when an attachment cannot be downloaded", async () => {
    global.fetch.mockResolvedValue({ ok: false });
    await expect(exportVisitPrep(options)).rejects.toThrow("Could not attach");
    expect(click).not.toHaveBeenCalled();
  });
});
