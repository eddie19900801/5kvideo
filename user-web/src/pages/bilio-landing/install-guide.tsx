import type { ProductRuntime } from "@/services/productRuntime";
import { bi, BiImg } from "./assets";
import "./style.css";
import "./install-guide.css";

export default function BilioInstallGuide({ product }: { product: ProductRuntime }) {
  return <main className="bi-install"><header><button onClick={() => history.back()}>‹</button><BiImg id={bi.icon}/><div><b>{product.name}</b><span>安装指南</span></div></header><section><h1>安装指南</h1><p>请根据您的手机系统完成安装。</p><h2>苹果手机</h2><ol><li>请使用 Safari 浏览器打开本页面。</li><li>点击首页下载按钮，按系统提示允许安装。</li><li>如出现未受信任提示，请前往“设置 → 通用 → VPN 与设备管理”，选择对应描述文件并信任。</li><li>返回桌面打开应用。</li></ol><h2>安卓手机</h2><ol><li>下载完成后打开 APK 安装包。</li><li>出现“未知来源应用”提示时，允许当前浏览器安装应用。</li><li>如遇安全扫描提示，请确认继续安装。</li><li>安装完成后返回桌面打开应用。</li></ol><button className="bi-guide-back" onClick={() => history.back()}>返回下载页面</button></section></main>;
}
