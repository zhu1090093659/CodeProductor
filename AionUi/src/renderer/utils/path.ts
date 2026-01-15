/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

const trimSeparators = (value: string, sep: string) => {
  let result = value;
  const escaped = sep === '\\' ? '\\\\' : sep;
  result = result.replace(new RegExp(`^${escaped}+`), '');
  result = result.replace(new RegExp(`${escaped}+$`), '');
  return result;
};

export const joinPath = (...parts: string[]) => {
  const filtered = parts.filter((part) => Boolean(part));
  if (filtered.length === 0) return '';
  const base = filtered[0];
  const sep = base.includes('\\') ? '\\' : '/';
  const normalizedBase = base.endsWith(sep) ? base.slice(0, -1) : base;
  const rest = filtered.slice(1).map((part) => trimSeparators(part, sep));
  return [normalizedBase, ...rest].join(sep);
};
