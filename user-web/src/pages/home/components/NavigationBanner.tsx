import FiveKAdSlot from "@/components/FiveKAdSlot";

const BANNER_ZONE = "ZN_A1BD01D65B6E249A60AB5A26";
const RECOMMENDATION_ZONE = "ZN_584774055B2DC9702C87750C";

export default function NavigationBanner() {
  return (
    <>
      <aside className="px-3 pt-3" aria-label="横幅广告">
        <FiveKAdSlot zone={BANNER_ZONE} limit={1} className="min-h-[90px] overflow-hidden rounded-lg bg-foreground-100" />
      </aside>
      <section className="px-3 pt-3" aria-label="热门推荐">
        <div className="mb-2 flex items-center justify-between">
          <b className="text-xs text-foreground-700">热门推荐</b>
          <small className="text-[9px] text-foreground-400">广告</small>
        </div>
        <FiveKAdSlot zone={RECOMMENDATION_ZONE} limit={0} className="min-h-[82px]" />
      </section>
    </>
  );
}
