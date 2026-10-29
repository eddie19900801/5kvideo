import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("usage: node strip-rc4-wrapper.mjs <directory>");
for (const name of await readdir(directory)) {
  if (!name.includes(".rc4-") || !name.endsWith(".webp")) continue;
  const input = await readFile(path.join(directory, name));
  const riff = input.indexOf(Buffer.from("RIFF"));
  if (riff < 0) throw new Error(`RIFF header not found: ${name}`);
  const declaredSize = input.readUInt32LE(riff + 4) + 8;
  const output = input.subarray(riff, riff + declaredSize);
  const target = name.replace(/\.rc4-[^.]+\.webp$/, ".source.webp");
  await writeFile(path.join(directory, target), output);
  console.log(`${name} -> ${target} (${output.length} bytes)`);
}
