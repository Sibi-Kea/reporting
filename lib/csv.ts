import { stringify } from "csv-stringify/sync";

export function toCsv(rows: Record<string, unknown>[]) {
  return stringify(rows, {
    header: true,
  });
}

