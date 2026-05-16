import type { AxiosResponse } from "axios";

export type ApiSuccess<T> = { data: T };
export type ApiList<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
};

export function unwrap<T>(res: AxiosResponse<ApiSuccess<T>>): T {
  return res.data.data;
}

export type UnwrappedList<T> = {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
};

export function unwrapList<T>(res: AxiosResponse<ApiList<T>>): UnwrappedList<T> {
  return {
    items: res.data.data,
    next_cursor: res.data.next_cursor,
    has_more: res.data.has_more,
  };
}
