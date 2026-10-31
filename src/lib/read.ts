/**
 * Readers for untrusted JSON: each checks one value and returns it typed, or throws a `ReadError`
 * naming the path of the value and what was expected there (`cards[3].rarity: expected N | R`).
 * Shared by the skill card file's loader (src/data/load.ts) and the memo's reader
 * (src/memo/read.ts), each of which turns a `ReadError` into its own error.
 */

/** A value does not have the shape its reader expects; the message names where. */
export class ReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadError";
  }
}

/** Reads one value as T, or throws naming `path`. */
export type Read<T> = (value: unknown, path: string) => T;
export type Fields = Record<string, unknown>;

export function fail(path: string, expected: string): never {
  throw new ReadError(`${path}: expected ${expected}`);
}

export function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const object: Read<Fields> = (value, path) => (isFields(value) ? value : fail(path, "an object"));
export const string: Read<string> = (value, path) => (typeof value === "string" ? value : fail(path, "a string"));
export const integer: Read<number> = (value, path) =>
  typeof value === "number" && Number.isInteger(value) ? value : fail(path, "an integer");
export const boolean: Read<boolean> = (value, path) => (typeof value === "boolean" ? value : fail(path, "true or false"));

export function oneOf<T extends string>(options: readonly T[]): Read<T> {
  return (value, path) => options.find((option) => option === value) ?? fail(path, options.join(" | "));
}

export function list<T>(item: Read<T>): Read<T[]> {
  return (value, path) =>
    Array.isArray(value) ? value.map((entry: unknown, i: number) => item(entry, `${path}[${i}]`)) : fail(path, "an array");
}

export function child(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

/** A required field. */
export function req<T>(fields: Fields, key: string, read: Read<T>, path: string): T {
  return read(fields[key], child(path, key));
}
