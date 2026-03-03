import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}
