import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function temporaryDirectory(testContext) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "dialysis-test-"));
  testContext.after(() => {
    if (
      path.dirname(path.resolve(directory)) !== temporaryRoot ||
      !path.basename(directory).startsWith("dialysis-test-")
    ) {
      throw new Error("Refusing to clean a directory outside this test run.");
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
