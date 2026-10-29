import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import { ok } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { userVideosRouter } from "./routes/userVideos.js";
import { config } from "./config.js";
import { videosRouter } from "./routes/videos.js";
import { adminCatalogRouter } from "./routes/adminCatalog.js";
import { adminVideosRouter } from "./routes/adminVideos.js";
import { adminMediaRouter } from "./routes/adminMedia.js";
import { adminUploadsRouter } from "./routes/adminUploads.js";
import { analyticsRouter } from "./routes/analytics.js";
import { publicMetadataRouter } from "./routes/publicMetadata.js";
import { cleanupStaleUploadTasks } from "./services/mediaLifecycle.js";
import { adminMediaJobsRouter } from "./routes/adminMediaJobs.js";
import { adminCollectorsRouter } from "./routes/adminCollectors.js";
import { optionalAuthenticate } from "./auth.js";
import { playbackAccess } from "./middleware/playbackAccess.js";
import { startCollectorCatalogScheduler } from "./services/collectorCatalogSync.js";
import { collectedVideosRouter } from "./routes/collectedVideos.js";
import { channelsRouter } from "./routes/channels.js";
import { productLinesRouter } from "./routes/productLines.js";
import { initializeDatabase, readDb } from "./db.js";
import { syncAllProductPackageManifests } from "./services/productPackages.js";
import { resumeProductDeployments } from "./services/productDeployment.js";
import { apiDocsHtml, openApiJson } from "./openapi.js";

export const app = express();
const { port, mediaDir, chunkDir } = config;
app.set("trust proxy", config.trustProxyHops);

fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(chunkDir, { recursive: true });
cleanupStaleUploadTasks();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: config.webOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));
app.use(
  "/media",
  (req, res, next) =>
    /\.(?:mp4|m3u8|ts|m4s)$/i.test(req.path)
      ? res.status(403).json({
          error: { code: "SIGNED_URL_REQUIRED", message: "视频需要授权播放" },
        })
      : next(),
  express.static(mediaDir, { acceptRanges: true, maxAge: "1h" }),
);
app.get("/health", (_, res) =>
  ok(res, { status: "ok", time: new Date().toISOString() }),
);
app.get("/api/v1/openapi.json", openApiJson);
app.get("/api/docs", apiDocsHtml);
app.use("/api/v1", optionalAuthenticate, playbackAccess);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/me", meRouter);
app.use("/api/v1/videos", userVideosRouter);
app.use("/api/v1/videos", videosRouter);
app.use("/api/v1/collected-videos", collectedVideosRouter);
app.use("/api/v1/admin", adminCatalogRouter);
app.use("/api/v1/admin", adminVideosRouter);
app.use("/api/v1/admin", adminMediaRouter);
app.use("/api/v1/admin", adminUploadsRouter);
app.use("/api/v1/admin", adminMediaJobsRouter);
app.use("/api/v1/admin", adminCollectorsRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", channelsRouter);
app.use("/api/v1", productLinesRouter);
app.use("/api/v1", publicMetadataRouter);
app.use((_, res) =>
  res.status(404).json({ error: { code: "NOT_FOUND", message: "接口不存在" } }),
);
export async function startServer(listenPort = port) {
  await initializeDatabase();
  syncAllProductPackageManifests(readDb());
  resumeProductDeployments();
  startCollectorCatalogScheduler();
  return app.listen(listenPort, () =>
    console.log(`5K Video API listening on http://localhost:${listenPort}`),
  );
}

const entryFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryFile === import.meta.url) void startServer();
