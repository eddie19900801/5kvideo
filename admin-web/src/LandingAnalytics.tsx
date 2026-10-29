import { useEffect, useState } from "react";
import { Card, Select, Space, Table, Tag, message } from "antd";
import { api } from "./api";

type Row = {
  date: string;
  pcVisits: number;
  pcUsers: number;
  androidVisits: number;
  androidUsers: number;
  iosVisits: number;
  iosUsers: number;
  unknownVisits: number;
  androidInstalls: number;
  iosInstalls: number;
};
type Result = {
  days: number;
  selectedChannel: string;
  selectedProduct: string;
  channels: Array<{ code: string; name: string }>;
  products: Array<{ id: string; slug: string; name: string }>;
  daily: Row[];
};

export default function LandingAnalytics() {
  const [days, setDays] = useState(30), [channel, setChannel] = useState(""), [product, setProduct] = useState("");
  const [data, setData] = useState<Result>(), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void api<Result>(`/admin/landing-analytics?days=${days}&channel=${encodeURIComponent(channel)}&product=${encodeURIComponent(product)}`)
      .then(value => { if (active) setData(value); })
      .catch(error => message.error(error.message))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, channel, product]);
  return <Card title="落地页数据分析" extra={<Space wrap>
    <Select value={product} style={{ width: 190 }} onChange={setProduct} options={[{ value: "", label: "全部产品" }, ...(data?.products || []).map(item => ({ value: item.id, label: `${item.name}（${item.slug}）` }))]} />
    <Select value={channel} style={{ width: 190 }} onChange={setChannel} options={[{ value: "", label: "全部渠道" }, ...(data?.channels || []).map(item => ({ value: item.code, label: `${item.name}（${item.code}）` }))]} />
    <Select value={days} style={{ width: 130 }} onChange={setDays} options={[{ value: 7, label: "最近 7 天" }, { value: 30, label: "最近 30 天" }, { value: 90, label: "最近 90 天" }, { value: 180, label: "最近 180 天" }]} />
  </Space>}>
    <p style={{ color: "#64748b", marginTop: -4 }}>按日期统计各设备的落地页访问和首次安装激活；渠道默认显示全部。</p>
    <Table<Row> rowKey="date" loading={loading} dataSource={data?.daily || []} pagination={{ pageSize: 20, showSizeChanger: false }} scroll={{ x: 980 }} columns={[
      { title: "日期", dataIndex: "date", fixed: "left", width: 120 },
      { title: "PC访问量", dataIndex: "pcVisits", width: 115 },
      { title: "PC用户", dataIndex: "pcUsers", width: 100 },
      { title: "Android访问量", dataIndex: "androidVisits", width: 135, render: value => <Tag color="green">{value}</Tag> },
      { title: "Android用户", dataIndex: "androidUsers", width: 125 },
      { title: "iOS访问量", dataIndex: "iosVisits", width: 115, render: value => <Tag color="blue">{value}</Tag> },
      { title: "iOS用户", dataIndex: "iosUsers", width: 100 },
      { title: "未识别设备", dataIndex: "unknownVisits", width: 115 },
      { title: "Android安装", dataIndex: "androidInstalls", width: 125 },
      { title: "iOS安装", dataIndex: "iosInstalls", width: 105 },
    ]} />
  </Card>;
}
