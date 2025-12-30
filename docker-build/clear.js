const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "outputs");

async function clearOutputs() {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  const entries = await fs.promises.readdir(OUTPUT_DIR);
  await Promise.all(
    entries.map((entry) => fs.promises.rm(path.join(OUTPUT_DIR, entry), { recursive: true, force: true }))
  );
  console.log(`Cleared ${entries.length} item(s) from ${path.relative(__dirname, OUTPUT_DIR)}`);
}

clearOutputs().catch((err) => {
  console.error("Failed to clear outputs:", err);
  process.exitCode = 1;
});
