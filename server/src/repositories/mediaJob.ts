import type { MediaJob } from "../types.js";

export interface MediaJobRepository {
  enqueue(input: Pick<MediaJob, "type" | "adminId" | "sourcePath" | "originalName">): MediaJob;
  list(adminId?: string): MediaJob[];
  findById(id: string): MediaJob | undefined;
  claimNext(): MediaJob | undefined;
  complete(id: string, output: NonNullable<MediaJob["output"]>): void;
  fail(id: string, error: string): void;
  retry(id: string): MediaJob | undefined;
}
