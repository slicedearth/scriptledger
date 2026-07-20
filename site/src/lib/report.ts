import reportInput from 'virtual:scriptledger-report';
import { PublicReportSchema } from '../../../src/contracts/index.js';

export const report = PublicReportSchema.parse(reportInput);
export const pages = report.capture.pages;
export const events = report.comparisonEvents;

export const origins = [...new Map(pages.flatMap((page) => page.requests).map((entry) => [entry.destination.origin, {
  origin: entry.destination.origin,
  classification: entry.classification,
  routes: [...new Set(pages.filter((page) => page.requests.some((requestEntry) => requestEntry.destination.origin === entry.destination.origin)).map((page) => page.route))],
  requests: pages.flatMap((page) => page.requests).filter((requestEntry) => requestEntry.destination.origin === entry.destination.origin).length,
}])).values()].sort((left, right) => left.origin.localeCompare(right.origin));

export const dependencyRows = pages.flatMap((page) => [...new Set(page.requests.map((entry) => entry.destination.origin))].map((origin) => ({ route: page.route, origin })));

export function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function formatObservationDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
