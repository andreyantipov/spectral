import { Brand } from "effect";

export type SessionId = string & Brand.Brand<"SessionId">;
export const SessionId = Brand.nominal<SessionId>();

export type BookmarkId = string & Brand.Brand<"BookmarkId">;
export const BookmarkId = Brand.nominal<BookmarkId>();

export type HistoryEntryId = string & Brand.Brand<"HistoryEntryId">;
export const HistoryEntryId = Brand.nominal<HistoryEntryId>();

export type PageId = string & Brand.Brand<"PageId">;
export const PageId = Brand.nominal<PageId>();
