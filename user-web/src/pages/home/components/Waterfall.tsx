import { Fragment } from "react";
import FiveKAdSlot from "@/components/FiveKAdSlot";
import type { VideoSummary } from "@/types";
import VideoCard from "./VideoCard";

const INLINE_AD_ZONE = "ZN_AF4A9E32FB0EDD35A167A282";
const INLINE_AD_LIMIT = 10;
const VIDEOS_PER_AD = 6;

export default function Waterfall({ videos }: { videos: VideoSummary[] }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 overflow-hidden px-3">
      {videos.map((video, index) => (
        <Fragment key={video.id}>
          <VideoCard video={video} priority={index < 4} />
          {(index + 1) % VIDEOS_PER_AD === 0 && (
            <aside className="col-span-2 my-1 min-w-0 max-w-full overflow-hidden" aria-label="推荐广告">
              <FiveKAdSlot zone={INLINE_AD_ZONE} limit={INLINE_AD_LIMIT} className="min-h-[82px]" />
            </aside>
          )}
        </Fragment>
      ))}
    </div>
  );
}
