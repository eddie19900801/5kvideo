import type { ProductRuntime } from "@/services/productRuntime";
import { HuangguoImage } from "./assets";
import "./ios-installation.css";

export default function HuangguoIosInstallation({ product }: { product: ProductRuntime }) {
  const goBack = () => {
    if (history.length > 1) history.back();
    else location.href = `/${location.search}`;
  };

  return <main className="hg-install-page">
    <header><button type="button" onClick={goBack} aria-label="返回">‹</button><h1>下载与安装教程</h1></header>
    <section className="hg-install-content">
      <div className="hg-install-product">
        <div><HuangguoImage asset="installIcon" className="hg-install-icon"/><strong>{product.name}</strong></div>
        <span>下载</span>
      </div>
      <h2>下载后请先安装描述文件</h2>
      <div className="hg-install-steps">
        <HuangguoImage asset="installStep1" alt="设置里点击通用"/>
        <HuangguoImage asset="installStep2" alt="点击 VPN 与设备管理"/>
        <HuangguoImage asset="installStep3" alt={`点击${product.name}描述文件`}/>
        <HuangguoImage asset="installStep4" alt="点击右上角安装"/>
      </div>
    </section>
  </main>;
}
