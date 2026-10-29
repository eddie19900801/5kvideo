import { BrowserRouter, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { analytics } from "./services/analytics";
import { performanceMonitor } from "./services/performance";
import RecommendationNotice from "./components/RecommendationNotice";
import AppDownloadFloating from "./components/AppDownloadFloating";
import PageSkeleton from "./pages/home/components/PageSkeleton";
import { productRuntime } from "./services/productRuntime";
import type { ProductRuntime } from "./services/productRuntime";
import ProductLandingPage from "./pages/product-landing/page";
import HuangdouLandingPage from "./pages/huangdou-landing/page";
import MadouLandingPage from "./pages/madou-landing/page";
import HuangguoLandingPage from "./pages/huangguo-landing/page";
import HuangguoIosInstallation from "./pages/huangguo-landing/ios-installation";
import { HuangguoAndroidInstallation, HuangguoIosStore } from "./pages/huangguo-landing/installation-pages";
import HaijiaoLanding from "./pages/haijiao-landing/page";
import HaijiaoIosStore from "./pages/haijiao-landing/ios-store";
import ModelMedia from "./pages/modelmedia-landing/page";
import Yinmu from "./pages/yinmu-landing/page";
import Lolita from "./pages/lolita-landing/page";
import SmCommunity from "./pages/smcommunity-landing/page";
import DarkDouyin from "./pages/dark-douyin-landing/page";
import Bilio from "./pages/bilio-landing/page";
import Short91 from "./pages/short91-landing/page";
import DouyinLanding from "./pages/douyin-landing/page";
import Seventeen from "./pages/seventeen-landing/page";
import Pzhan from "./pages/pzhan-landing/page";
import Xingba from "./pages/xingba-landing/page";
import Qiiyou from "./pages/qiiyou-landing/page";
import ChengrenTiktok from "./pages/chengrentiktok-landing/page";
import ChengrenKuaishou from "./pages/chengrenkuaishou-landing/page";
import AnwangJinqu from "./pages/anwangjinqu-landing/page";
import Chengse from "./pages/chengse-landing/page";
import Xporn from "./pages/xporn-landing/page";
import JinguoDuanju from "./pages/jinguoduanju-landing/page";
import MrHaose from "./pages/mrhaose-landing/page";
import TangxinVlog from "./pages/tangxinvlog-landing/page";
import Duanju91 from "./pages/91duanju-landing/page";
import TangxinManju from "./pages/tangxinmanju-landing/page";
import Huanghuo from "./pages/huanghuoduanju-landing/page";
import Huanggua from "./pages/huangguaduanju-landing/page";
import Miyou from "./pages/miyouduanju-landing/page";
import Lulu from "./pages/luluduanju-landing/page";
import StartupLoading from "./components/StartupLoading";

function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => { void analytics.appOpen(); performanceMonitor.init(); }, []);
  useEffect(
    () =>
      analytics.track("page_view", { metadata: { path: location.pathname } }),
    [location.pathname],
  );
  return null;
}

function App() {
  const [product, setProduct] = useState<ProductRuntime | null>(null);
  const [bootVisible, setBootVisible] = useState(true);
  const isInstallationPage = ["/ios-installation.html", "/ios.html", "/android-installation.html"].includes(location.pathname);
  useEffect(() => { void productRuntime.load().then(setProduct); }, []);
  useEffect(() => { document.getElementById("preboot")?.remove(); }, []);
  const hideBoot = useCallback(() => setBootVisible(false), []);
  let content = <PageSkeleton />;
  if (product?.hostMode === "landing" && product.slug === "91xueyuan") content = <ProductLandingPage product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "huangdou") content = <HuangdouLandingPage product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "madou") content = <MadouLandingPage product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "huangguo") content = location.pathname === "/ios-installation.html" ? <HuangguoIosInstallation product={product} /> : location.pathname === "/ios.html" ? <HuangguoIosStore product={product} /> : location.pathname === "/android-installation.html" ? <HuangguoAndroidInstallation product={product} /> : <HuangguoLandingPage product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "haijiao") content = location.pathname === "/ios.html" ? <HaijiaoIosStore product={product} /> : <HaijiaoLanding product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "modelmedia") content = <ModelMedia product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "yinmu91") content = <Yinmu product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "lolidao") content = <Lolita product={product} />;
  else if (product?.hostMode === "landing" && (product.slug === "smshequ" || product.slug === "smcommunity")) content = <SmCommunity product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "anheidouyin18") content = <DarkDouyin product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "bilio3") content = <Bilio product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "91duanship") content = <Short91 product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "douyin") content = <DouyinLanding product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "17sui") content = <Seventeen product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "pzhan") content = <Pzhan product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "xingba") content = <Xingba product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "qiiyou") content = <Qiiyou product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "chengrentiktok") content = <ChengrenTiktok product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "chengrenkuaishou") content = <ChengrenKuaishou product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "anwangjinqu") content = <AnwangJinqu product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "chengse") content = <Chengse product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "xporn") content = <Xporn product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "jinguoduanju") content = <JinguoDuanju product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "mrhaose") content = <MrHaose product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "tangxinvlog") content = <TangxinVlog product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "91duanju") content = <Duanju91 product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "tangxinmanju") content = <TangxinManju product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "huanghuoduanju") content = <Huanghuo product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "huangguaduanju") content = <Huanggua product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "miyouduanju") content = <Miyou product={product} />;
  else if (product?.hostMode === "landing" && product.slug === "luluduanju") content = <Lulu product={product} />;
  else if (product?.hostMode === "landing" && product.landingPage === null) content = <main aria-label="落地页待配置" className="min-h-screen bg-white" />;
  else if (product) content = (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <AnalyticsTracker />
        <AppRoutes />
        <AppDownloadFloating />
        <RecommendationNotice />
      </BrowserRouter>
    </I18nextProvider>
  );
  return <>{content}{bootVisible && !isInstallationPage && <StartupLoading ready={Boolean(product)} onDone={hideBoot} />}</>;
}

export default App;
