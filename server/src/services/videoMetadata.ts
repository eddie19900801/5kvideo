export function normalizeTags(values: unknown[]) {
  const seen = new Set<string>();
  return values.flatMap(value => String(value ?? '').replace(/^\s*\[|\]\s*$/g, '').split(/[,，、;；\r\n]+/u))
    .map(value => value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim())
    .filter(value => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

