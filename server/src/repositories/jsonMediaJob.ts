import { randomUUID } from "node:crypto";
import type { MediaJob } from "../types.js";
import type { DatabaseRepository } from "./database.js";
import type { MediaJobRepository } from "./mediaJob.js";

export class JsonMediaJobRepository implements MediaJobRepository {
  constructor(private readonly database: DatabaseRepository) {}
  enqueue(input: Pick<MediaJob, "type" | "adminId" | "sourcePath" | "originalName">): MediaJob {
    const now = new Date().toISOString();
    const job: MediaJob = { id: randomUUID(), ...input, status: "queued", attempts: 0, createdAt: now, updatedAt: now };
    return this.database.transaction((database) => { database.mediaJobs.push(job); return job; });
  }
  list(adminId?: string): MediaJob[] {
    return this.database.read().mediaJobs.filter((job) => !adminId || job.adminId === adminId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  findById(id: string): MediaJob | undefined { return this.database.read().mediaJobs.find((job) => job.id === id); }
  claimNext(): MediaJob | undefined {
    return this.database.transaction((database) => {
      const job = database.mediaJobs.find((item) => item.status === "queued");
      if (!job) return undefined;
      job.status = "processing"; job.attempts++; job.updatedAt = new Date().toISOString(); delete job.error;
      return job;
    });
  }
  complete(id: string, output: NonNullable<MediaJob["output"]>): void { this.update(id, (job) => { job.status = "completed"; job.output = output; delete job.error; }); }
  fail(id: string, error: string): void { this.update(id, (job) => { job.status = "failed"; job.error = error.slice(0, 2000); }); }
  retry(id: string): MediaJob | undefined {
    return this.database.transaction((database) => {
      const job = database.mediaJobs.find((item) => item.id === id && item.status === "failed");
      if (!job) return undefined;
      job.status = "queued"; job.updatedAt = new Date().toISOString(); delete job.error; return job;
    });
  }
  private update(id: string, operation: (job: MediaJob) => void) { this.database.transaction((database) => { const job = database.mediaJobs.find((item) => item.id === id); if (job) { operation(job); job.updatedAt = new Date().toISOString(); } }); }
}
