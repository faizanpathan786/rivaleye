type OkResponse<T> = { data: T };
type ListResponse<T> = { data: T[]; next_cursor: string | null; has_more: boolean };
type ErrResponse = { error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T): OkResponse<T> {
  return { data };
}

export function okList<T>(rows: T[]): ListResponse<T> {
  return { data: rows, next_cursor: null, has_more: false };
}

export function okPaginated<T>(rows: T[], next_cursor: string | null, has_more: boolean): ListResponse<T> {
  return { data: rows, next_cursor, has_more };
}

export function err(code: string, message: string, details?: unknown): ErrResponse {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } };
}
