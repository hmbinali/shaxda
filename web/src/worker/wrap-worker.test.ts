// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { wrapWorker } from "../../scripts/wrap-worker.mjs";

it("keeps both entries out of the assets and wraps only once", () => {
  const output = mkdtempSync(join(tmpdir(), "shaxda-worker-"));
  try {
    const entry = join(output, "_worker.js");
    const kit = join(output, "_kit_worker.js");
    const ignore = join(output, ".assetsignore");
    const adapterWorker = "export default { fetch() {} };";
    writeFileSync(entry, adapterWorker);
    writeFileSync(ignore, "_redirects");
    expect(() => wrapWorker(output)).toThrow("_worker.js");
    expect(readFileSync(entry, "utf8")).toBe(adapterWorker);

    writeFileSync(ignore, "_worker.js\n_redirects");
    wrapWorker(output);
    const wrapper = readFileSync(entry, "utf8");
    expect(wrapper).toContain('import kit from "./_kit_worker.js"');
    expect(wrapper).toContain("fetch: kit.fetch, scheduled");
    expect(wrapper).toContain("export { RatingsEntrypoint }");
    expect(readFileSync(kit, "utf8")).toBe(adapterWorker);
    expect(readFileSync(ignore, "utf8")).toBe(
      "_worker.js\n_redirects\n_kit_worker.js\n",
    );

    wrapWorker(output);
    expect(readFileSync(entry, "utf8")).toBe(wrapper);
    expect(readFileSync(kit, "utf8")).toBe(adapterWorker);
    expect(readFileSync(ignore, "utf8")).toBe(
      "_worker.js\n_redirects\n_kit_worker.js\n",
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
