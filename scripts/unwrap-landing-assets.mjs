import fs from "node:fs";
import path from "node:path";

const [sourceArg, targetArg, keyText = "VaEpTl7!CIt9SLe%"] = process.argv.slice(2);
if (!sourceArg || !targetArg) throw new Error("usage: node unwrap-landing-assets.mjs <source> <target> [rc4-key]");
const source = path.resolve(sourceArg);
const target = path.resolve(targetArg);
const key = Buffer.from(keyText, "utf8");
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
  const marked = name.includes(".rc4-");
  const wrapped = marked && input.length > 62 && input.subarray(0, 12).every((value) => value === 0);
  let output = wrapped ? input.subarray(34, -28) : marked ? rc4(input) : input;
  if (output.subarray(0, 4).toString("ascii") === "RIFF" && output.length >= 8) {
    output = output.subarray(0, Math.min(output.length, output.readUInt32LE(4) + 8));
  }
  const finalName = name.replace(".rc4-", "-");
  fs.writeFileSync(path.join(target, finalName), output);
  process.stdout.write(`${finalName}\t${output.length}\t${output.subarray(0, 12).toString("hex")}\n`);
}
