import fs from "node:fs";
import path from "node:path";

const key = Buffer.from("VaEpTl7!CIt9SLe%", "utf8");
const source = path.resolve(".tmp-lp008-assets/raw");
const target = path.resolve(".tmp-lp008-assets/decoded");
fs.mkdirSync(target, { recursive: true });

function rc4(input) {
  const state = Uint8Array.from({ length: 256 }, (_, index) => index);
  let cursor = 0;
  for (let index = 0; index < 256; index += 1) {
    cursor = (cursor + state[index] + key[index % key.length]) & 255;
    [state[index], state[cursor]] = [state[cursor], state[index]];
  }
  const output = Buffer.alloc(input.length);
  let i = 0;
  cursor = 0;
  for (let index = 0; index < input.length; index += 1) {
    i = (i + 1) & 255;
    cursor = (cursor + state[i]) & 255;
    [state[i], state[cursor]] = [state[cursor], state[i]];
    output[index] = input[index] ^ state[(state[i] + state[cursor]) & 255];
  }
  return output;
}

for (const name of fs.readdirSync(source)) {
  const input = fs.readFileSync(path.join(source, name));
  // This template labels wrapped assets as RC4, but the deployed payloads use
  // a 34-byte prefix and 28-byte suffix around the original image.
  const wrapped = name.includes(".rc4-") && input.subarray(0, 12).every((value) => value === 0);
  let output = wrapped ? input.subarray(34, -28) : name.includes(".rc4-") ? rc4(input) : input;
  if (output.subarray(0, 4).toString("ascii") === "RIFF" && output.length >= 8) {
    output = output.subarray(0, Math.min(output.length, output.readUInt32LE(4) + 8));
  }
  fs.writeFileSync(path.join(target, name.replace(".rc4-", "-")), output);
  process.stdout.write(`${name}\t${output.length}\t${output.subarray(0, 12).toString("hex")}\n`);
}
