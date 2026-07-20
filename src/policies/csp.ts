import { stripControlCharacters } from '../security/url.js';

export type ParsedCsp = ReadonlyMap<string, readonly string[]>;

function normalizeSource(source: string): string {
  const value = stripControlCharacters(source.trim(), 512);
  if (/^'nonce-[^']+'$/iu.test(value)) return "'nonce-*'";
  if (/^'(sha256|sha384|sha512)-[^']+'$/iu.test(value)) return `'${value.slice(1, 7).toLowerCase()}-*'`;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(value)) {
      const url = new URL(value);
      url.hostname = url.hostname.toLowerCase();
      return url.toString().replace(/\/$/u, '');
    }
  } catch {
    return value.toLowerCase();
  }
  return value.toLowerCase();
}

export function parseCsp(value: string): ParsedCsp {
  const directives = new Map<string, readonly string[]>();
  for (const segment of stripControlCharacters(value, 8_192).split(';')) {
    const tokens = segment.trim().split(/\s+/u).filter(Boolean);
    const name = tokens.shift()?.toLowerCase();
    if (!name || !/^[a-z][a-z0-9-]*$/u.test(name)) continue;
    const sources = [...new Set(tokens.map(normalizeSource))].sort();
    directives.set(name, sources);
  }
  return new Map([...directives.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function serializeCsp(policy: ParsedCsp): string {
  return [...policy.entries()].map(([name, sources]) => [name, ...sources].join(' ')).join('; ');
}

export function effectiveSources(policy: ParsedCsp, directive: string): readonly string[] | undefined {
  return policy.get(directive) ?? policy.get('default-src');
}

export function addedSources(before: ParsedCsp, after: ParsedCsp, directive: string): string[] {
  const oldSources = new Set(effectiveSources(before, directive) ?? []);
  return [...(effectiveSources(after, directive) ?? [])].filter((source) => !oldSources.has(source)).sort();
}

export function containsSource(policy: ParsedCsp, directive: string, source: string): boolean {
  return (effectiveSources(policy, directive) ?? []).includes(source);
}

export function constraintRemoved(before: ParsedCsp, after: ParsedCsp, directive: string, value: string): boolean {
  return (before.get(directive) ?? []).includes(value) && !(after.get(directive) ?? []).includes(value);
}
