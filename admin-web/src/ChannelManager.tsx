import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Space, Table, message } from "antd";
import { CopyOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { api } from "./api";

type Channel = { id: string; code: string; name: string; createdAt: string };
const videoWebUrl = (import.meta.env.VITE_VIDEO_WEB_URL || "https://5knews.wflhc.cn/").replace(/\/?$/, "/");
const channelUrl = (code: string) => `${videoWebUrl}?channel=${encodeURIComponent(code)}`;
const apkUrl = (code: string) => `${videoWebUrl}downloads/ppfree-${code}.apk`;
const iosUrl = (code: string) => `${window.location.origin}/vdo/api/v1/channels/${encodeURIComponent(code)}/ios.mobileconfig`;

export default function ChannelManager() {
  const [rows, setRows] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ name: string }>();
  const load = async () => {
    setLoading(true);
    try { setRows(await api<Channel[]>("/admin/channels")); }
    catch (error) { message.error((error as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const create = async ({ name }: { name: string }) => {
    setSaving(true);
    try {
      await api<Channel>("/admin/channels", { method: "POST", body: JSON.stringify({ name }) });
      form.resetFields();
      message.success("渠道添加成功");
      await load();
    } catch (error) { message.error((error as Error).message); }
    finally { setSaving(false); }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); message.success("渠道地址已复制"); }
    catch { message.error("复制失败，请手动复制"); }
  };
  return <Card title="渠道管理" extra={<Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>}>
    <Form form={form} layout="inline" onFinish={create} style={{ marginBottom: 20 }}>
      <Form.Item name="name" label="渠道备注名" rules={[{ required: true, message: "请填写渠道备注名" }, { max: 50 }]}>
        <Input placeholder="例如：代理A、Telegram投放" style={{ width: 280 }} maxLength={50} />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={saving}>添加渠道</Button>
    </Form>
    <Table rowKey="id" loading={loading} dataSource={rows} pagination={{ pageSize: 20 }} columns={[
      { title: "备注名", dataIndex: "name", width: 180 },
      { title: "渠道编号", dataIndex: "code", width: 170 },
      { title: "渠道地址", render: (_, row) => <Space.Compact><Input readOnly value={channelUrl(row.code)} style={{ width: 330 }} /><Button icon={<CopyOutlined />} onClick={() => void copy(channelUrl(row.code))}>复制</Button></Space.Compact> },
      { title: "Android渠道包", render: (_, row) => <Space.Compact><Input readOnly value={apkUrl(row.code)} style={{ width: 330 }} /><Button icon={<CopyOutlined />} onClick={() => void copy(apkUrl(row.code))}>复制</Button></Space.Compact> },
      { title: "iOS安装地址", render: (_, row) => <Space.Compact><Input readOnly value={iosUrl(row.code)} style={{ width: 390 }} /><Button icon={<CopyOutlined />} onClick={() => void copy(iosUrl(row.code))}>复制</Button></Space.Compact> },
      { title: "创建时间", dataIndex: "createdAt", width: 190, render: value => new Date(value).toLocaleString("zh-CN") },
    ]} scroll={{ x: 1750 }} />
  </Card>;
}
