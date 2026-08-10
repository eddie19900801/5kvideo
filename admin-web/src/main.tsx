import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Card,
  ConfigProvider,
  Form,
  Image,
  Input,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from "antd";
import {
  DashboardOutlined,
  EditOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { api, uploadMedia } from "./api";
import "antd/dist/reset.css";
import "./style.css";
const CoverEditor = React.lazy(() => import("./CoverEditor"));
const Analytics = React.lazy(() => import("./Analytics"));
type Video = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  playbackUrl: string;
  duration: number;
  tags: string[];
  chapters?: { id: string; label: string; time: number }[];
  views: number;
  aspectRatio: "portrait" | "landscape";
  isAdult: boolean;
  status: "draft" | "processing" | "published" | "offline";
};
const formatDuration = (value: number) => {
  const total = Math.max(0, Math.round(Number(value) || 0)),
    hours = Math.floor(total / 3600),
    minutes = Math.floor((total % 3600) / 60),
    seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
};
type Values = {
  title: string;
  description?: string;
  tags?: string;
  isAdult: boolean;
  status: Video["status"];
};
type AdminUser = {
  id: string;
  account: string;
  username: string;
  isGuest?: boolean;
  status: string;
  visitCount?: number;
  totalWatchSeconds?: number;
  lastSeenAt?: string;
  createdAt: string;
  favoriteCount: number;
  historyCount: number;
};
type ManagedTag = {
  id: string;
  name: string;
  usageCount: number;
  createdAt: string;
};
type UploadTask = {
  id: string;
  title: string;
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
  status: "uploading" | "processing" | "success" | "error";
  error?: string;
};
function Login({ done }: { done: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="login">
      <Card title="5K视频管理后台" className="login-card">
        <Form
          layout="vertical"
          initialValues={{ account: "admin" }}
          onFinish={async (v) => {
            setLoading(true);
            try {
              const r = await api<{ token: string }>("/auth/login", {
                method: "POST",
                body: JSON.stringify(v),
              });
              localStorage.setItem("admin_token", r.token);
              done();
            } catch (e) {
              message.error((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <Form.Item name="account" label="账号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, min: 6 }]}
          >
            <Input.Password />
          </Form.Item>
          <Button block type="primary" htmlType="submit" loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
function App() {
  const [form] = Form.useForm<Values>();
  const currentTags = Form.useWatch("tags", form) || "";
  const [logged, setLogged] = useState(!!localStorage.getItem("admin_token"));
  const [active, setActive] = useState("videos");
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tags, setTags] = useState<ManagedTag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [tagAdding, setTagAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Video>();
  const [videoFile, setVideoFile] = useState<File>();
  const [coverEditing, setCoverEditing] = useState<Video>();
  const [saving, setSaving] = useState(false);
  const [nodeVideo, setNodeVideo] = useState<Video>();
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodes, setNodes] = useState<
    { id: string; label: string; time: number }[]
  >([]);
  const [nodeSaving, setNodeSaving] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [refreshingVideoId, setRefreshingVideoId] = useState<string>();
  const [commonTagsExpanded, setCommonTagsExpanded] = useState(false);
  const nodePlayer = useRef<HTMLVideoElement>(null);
  const load = async () => {
    try {
      const list = await api<Video[]>("/admin/videos");
      setVideos(list);
      return list;
    } catch (e) {
      message.error((e as Error).message);
      return undefined;
    }
  };
  const loadUsers = () =>
    api<AdminUser[]>("/admin/users")
      .then(setUsers)
      .catch((e) => message.error(e.message));
  const loadTags = () =>
    api<ManagedTag[]>("/admin/tags")
      .then(setTags)
      .catch((e) => message.error(e.message));
  const addTag = async () => {
    const name = newTag.trim();
    if (!name || tagAdding) return;
    const existing = tags.find(
      (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (existing) {
      setNewTag("");
      setTagSearch(existing.name);
      message.warning(`标签“${existing.name}”已存在，已在列表中定位`);
      return;
    }
    setTagAdding(true);
    try {
      await api("/admin/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewTag("");
      setTagSearch(name);
      await loadTags();
      message.success(`标签“${name}”已添加`);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setTagAdding(false);
    }
  };
  const refreshVideo = async (id: string) => {
    setRefreshingVideoId(id);
    try {
      const refreshed = await api<Video>(`/admin/videos/${id}`);
      setVideos((list) => list.map((video) => video.id === id ? refreshed : video));
      message.success("该视频已刷新");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setRefreshingVideoId(undefined);
    }
  };
  useEffect(() => {
    if (logged) {
      load();
      loadUsers();
      loadTags();
    }
  }, [logged]);
  useEffect(()=>{const sync=()=>{const match=location.hash.match(/^#cover\/(.+)$/);if(!match){setCoverEditing(undefined);return}const found=videos.find(v=>v.id===decodeURIComponent(match[1]));if(found)setCoverEditing(found)};sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync)},[videos]);
  if (!logged) return <Login done={() => setLogged(true)} />;
  if (coverEditing) return <React.Suspense fallback={<div className="page-loading">正在加载封面编辑器…</div>}><CoverEditor video={coverEditing} onBack={()=>{location.hash="";setCoverEditing(undefined)}} onSaved={(thumbnail)=>{setVideos(list=>list.map(v=>v.id===coverEditing.id?{...v,thumbnail}:v));location.hash="";setCoverEditing(undefined)}}/></React.Suspense>;
  const close = () => {
    setOpen(false);
    setEditing(undefined);
    setVideoFile(undefined);
    setCommonTagsExpanded(false);
    form.resetFields();
  };
  const create = () => {
    setEditing(undefined);
    setCommonTagsExpanded(false);
    form.setFieldsValue({
      title: "",
      description: "",
      tags: "",
      isAdult: true,
      status: "draft",
    });
    setOpen(true);
  };
  const edit = (v: Video) => {
    setEditing(v);
    setCommonTagsExpanded(false);
    form.setFieldsValue({
      title: v.title,
      description: v.description,
      tags: v.tags.join(","),
      isAdult: v.isAdult,
      status: v.status,
    });
    setOpen(true);
  };
  const editNodes = (v: Video) => {
    setNodeVideo(v);
    setNodes([...(v.chapters || [])].sort((a, b) => a.time - b.time));
    setNodeLabel("");
  };
  const addNodeAtCurrentTime = (label: string) => {
    const player = nodePlayer.current;
    const text = label.trim();
    if (!player || !text) return;
    const time = Number(player.currentTime.toFixed(2));
    setNodes((prev) =>
      [...prev, { id: crypto.randomUUID(), label: text, time }].sort(
        (a, b) => a.time - b.time,
      ),
    );
    setNodeLabel("");
  };
  const appendTag = (name: string) => {
    const list = currentTags
      .split(",")
      .map((x: string) => x.trim())
      .filter(Boolean);
    if (!list.includes(name))
      form.setFieldValue("tags", [...list, name].join(","));
  };
  const submit = async (values: Values) => {
    if (!editing && !videoFile) return message.error("请选择视频文件");
    const metadata = {
      ...values,
      status: editing ? values.status : "draft",
      tags: (values.tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    if (editing) {
      setSaving(true);
      try {
        await api(`/admin/videos/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(metadata),
        });
        message.success("视频资料已更新");
        close();
        load();
        loadTags();
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setSaving(false);
      }
      return;
    }
    const file = videoFile!,
      taskId = crypto.randomUUID();
    setUploadTasks((prev) => [
      {
        id: taskId,
        title: values.title,
        fileName: file.name,
        loaded: 0,
        total: file.size,
        percent: 0,
        status: "uploading",
      },
      ...prev,
    ]);
    close();
    message.success("已加入上传任务，可继续管理其他视频");
    void (async () => {
      try {
        const data = new FormData();
        data.append("video", file);
        const media = await uploadMedia(data, (loaded, total) =>
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    loaded,
                    total,
                    percent: Math.round((loaded / total) * 100),
                  }
                : t,
            ),
          ),
        );
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, loaded: t.total, percent: 100, status: "processing" }
              : t,
          ),
        );
        const created = await api<Video>("/admin/videos", {
          method: "POST",
          body: JSON.stringify({ ...metadata, ...media }),
        });
        // 创建接口成功即先更新界面，避免再次拉取列表受网络延迟影响。
        setVideos((prev) => [
          created,
          ...prev.filter((video) => video.id !== created.id),
        ]);
        setUploadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "success" } : t)),
        );
        message.success(`${values.title} 已上传，当前为待发布状态`);
        await Promise.all([load(), loadTags()]);
        setTimeout(
          () => setUploadTasks((prev) => prev.filter((t) => t.id !== taskId)),
          3000,
        );
      } catch (e) {
        const error = (e as Error).message;
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: "error", error } : t,
          ),
        );
        message.error(error);
      }
    })();
  };
  return (
    <Layout className="shell">
      <Layout.Sider theme="dark">
        <div className="brand">5K VIDEO</div>
        <Menu
          theme="dark"
          selectedKeys={[active]}
          onClick={({ key }) => {
            setActive(key);
            if (key === "users") loadUsers();
            if (key === "tags") loadTags();
          }}
          items={[
            {
              key: "dashboard",
              icon: <DashboardOutlined />,
              label: "数据概览",
            },
            { key: "videos", icon: <VideoCameraOutlined />, label: "视频管理" },
            { key: "tags", label: "标签管理" },
            { key: "users", label: "用户管理" },
            {
              key: "analytics",
              icon: <DashboardOutlined />,
              label: "数据分析",
            },
          ]}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="header">
          <b>内容管理</b>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              localStorage.removeItem("admin_token");
              setLogged(false);
            }}
          >
            退出
          </Button>
        </Layout.Header>
        <Layout.Content className="content">
          <Space size={16} className="stats">
            <Card>
              <Statistic title="视频总数" value={videos.length} />
            </Card>
            <Card>
              <Statistic title="用户总数" value={users.length} />
            </Card>
            <Card>
              <Statistic
                title="总播放"
                value={videos.reduce((a, v) => a + v.views, 0)}
              />
            </Card>
          </Space>
          {active === "analytics" ? (
            <React.Suspense fallback={<Card loading />}>
              <Analytics />
            </React.Suspense>
          ) : active === "users" ? (
            <Card title="用户管理">
              <Table
                rowKey="id"
                dataSource={users}
                columns={[
                  {
                    title: "身份",
                    render: (_, u) => (
                      <Tag color={u.isGuest || !u.account ? "default" : "blue"}>
                        {u.isGuest || !u.account ? "游客" : "注册用户"}
                      </Tag>
                    ),
                  },
                  { title: "用户名", dataIndex: "username" },
                  {
                    title: "账号",
                    dataIndex: "account",
                    render: (x) => x || "-",
                  },
                  {
                    title: "访问次数",
                    dataIndex: "visitCount",
                    render: (x) => x || 0,
                  },
                  {
                    title: "观看时长",
                    dataIndex: "totalWatchSeconds",
                    render: (x) => `${Math.floor((x || 0) / 60)} 分钟`,
                  },
                  { title: "收藏", dataIndex: "favoriteCount" },
                  { title: "历史", dataIndex: "historyCount" },
                  {
                    title: "最近访问",
                    dataIndex: "lastSeenAt",
                    render: (x) => (x ? new Date(x).toLocaleString() : "-"),
                  },
                  {
                    title: "注册/首次访问",
                    dataIndex: "createdAt",
                    render: (x) => new Date(x).toLocaleString(),
                  },
                ]}
              />
            </Card>
          ) : active === "tags" ? (
            <Card
              title="标签管理"
              extra={
                <Space.Compact>
                  <Input
                    value={newTag}
                    maxLength={20}
                    placeholder="输入标签名称"
                    onChange={(e) => setNewTag(e.target.value)}
                    onPressEnter={() => void addTag()}
                  />
                  <Button
                    type="primary"
                    loading={tagAdding}
                    disabled={!newTag.trim()}
                    onClick={() => void addTag()}
                  >
                    添加标签
                  </Button>
                </Space.Compact>
              }
            >
              <Input.Search
                allowClear
                value={tagSearch}
                placeholder="模糊搜索标签名称"
                onChange={(event) => setTagSearch(event.target.value)}
                style={{ width: 320, maxWidth: "100%", marginBottom: 16 }}
              />
              <Table
                rowKey="id"
                dataSource={tags.filter((tag) =>
                  tag.name.toLocaleLowerCase().includes(tagSearch.trim().toLocaleLowerCase()),
                )}
                columns={[
                  {
                    title: "标签名称",
                    dataIndex: "name",
                    render: (name) => <Tag color="orange">{name}</Tag>,
                  },
                  { title: "使用视频数", dataIndex: "usageCount" },
                  {
                    title: "创建时间",
                    dataIndex: "createdAt",
                    render: (x) => new Date(x).toLocaleString(),
                  },
                  {
                    title: "操作",
                    render: (_, tag) => (
                      <Button
                        danger
                        disabled={tag.usageCount > 0}
                        onClick={async () => {
                          try {
                            await api(`/admin/tags/${tag.id}`, {
                              method: "DELETE",
                            });
                            loadTags();
                          } catch (e) {
                            message.error((e as Error).message);
                          }
                        }}
                      >
                        删除
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>
          ) : (
            <Card
              title="视频管理"
              extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={create}>
                  上传视频
                </Button>
              }
            >
              {uploadTasks.length > 0 && (
                <div className="upload-task-list">
                  {uploadTasks.map((task) => (
                    <div className="upload-task" key={task.id}>
                      <div className="upload-task-head"><div><b>{task.title}</b><span>{task.fileName}</span></div><Tag color={task.status === "error" ? "red" : task.status === "success" ? "green" : task.status === "processing" ? "blue" : "orange"}>{task.status === "uploading" ? "上传中" : task.status === "processing" ? "处理中" : task.status === "success" ? "待发布" : "失败"}</Tag></div>
                      <Progress percent={task.percent} status={task.status === "error" ? "exception" : task.status === "success" ? "success" : "active"}/>
                      <div className="upload-size">{(task.loaded / 1024 / 1024).toFixed(2)} MB / {(task.total / 1024 / 1024).toFixed(2)} MB · {task.percent}%{task.error && <span className="upload-error"> · {task.error}</span>}</div>
                    </div>
                  ))}
                </div>
              )}
              <Table
                rowKey="id"
                dataSource={videos}
                columns={[
                  {
                    title: "封面",
                    dataIndex: "thumbnail",
                    render: (x, video) => (
                      <Image
                        src={x}
                        alt={`${video.title}封面`}
                        width={96}
                        height={54}
                        className="thumb"
                        preview={{ mask: "点击放大" }}
                      />
                    ),
                  },
                  { title: "标题", dataIndex: "title" },
                  {
                    title: "时长",
                    dataIndex: "duration",
                    render: formatDuration,
                  },
                  { title: "播放次数", dataIndex: "views" },
                  {
                    title: "标签",
                    dataIndex: "tags",
                    render: (x) => x.map((t: string) => <Tag key={t}>{t}</Tag>),
                  },
                  {
                    title: "内容",
                    dataIndex: "isAdult",
                    render: (x) =>
                      x ? (
                        <Tag color="red">18+</Tag>
                      ) : (
                        <Tag color="green">普通</Tag>
                      ),
                  },
                  {
                    title: "状态",
                    dataIndex: "status",
                    render: (x) => (
                      <Tag color={x === "published" ? "green" : "default"}>
                        {x === "published" ? "已发布" : x === "draft" ? "待发布" : x === "processing" ? "处理中" : "已下架"}
                      </Tag>
                    ),
                  },
                  {
                    title: "操作",
                    render: (_, v) => (
                      <Space>
                        <Button
                          icon={<ReloadOutlined />}
                          loading={refreshingVideoId === v.id}
                          onClick={() => void refreshVideo(v.id)}
                        >
                          刷新
                        </Button>
                        <Button icon={<EditOutlined />} onClick={() => edit(v)}>
                          编辑
                        </Button>
                        <Button onClick={() => { const url=`${location.origin}${location.pathname}#cover/${encodeURIComponent(v.id)}`;window.open(url,"_blank","noopener,noreferrer"); }}>封面编辑</Button>
                        <Button onClick={() => editNodes(v)}>精彩标签</Button>
                        <Button
                          danger
                          disabled={v.status === "offline"}
                          onClick={async () => {
                            await api(`/admin/videos/${v.id}`, {
                              method: "DELETE",
                            });
                            load();
                          }}
                        >
                          下架
                        </Button>
                        <Popconfirm
                          title="确认删除这个视频？"
                          description="视频会从前台、收藏和观看记录中移除，媒体文件进入服务器回收目录。"
                          okText="确认删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                          onConfirm={async () => {
                            try {
                              await api(`/admin/videos/${v.id}/permanent`, {
                                method: "DELETE",
                              });
                              message.success("视频已删除");
                              load();
                            } catch (e) {
                              message.error((e as Error).message);
                            }
                          }}
                        >
                          <Button danger type="primary">
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          )}
          <Modal
            open={open}
            title={editing ? "编辑视频" : "上传视频"}
            footer={null}
            onCancel={close}
            destroyOnHidden
            width={600}
          >
            <Form form={form} layout="vertical" onFinish={submit}>
              {!editing && (
                <>
                  <Form.Item
                    label="视频文件"
                    required
                    extra="系统自动识别时长和横竖方向"
                  >
                    <Upload
                      accept="video/*"
                      maxCount={1}
                      beforeUpload={(file) => {
                        setVideoFile(file);
                        return false;
                      }}
                      onRemove={() => setVideoFile(undefined)}
                    >
                      <Button icon={<UploadOutlined />}>选择视频</Button>
                    </Upload>
                  </Form.Item>
                </>
              )}
              {editing && (
                <img src={editing.thumbnail} className="edit-cover" />
              )}
              <Form.Item
                name="title"
                label="标题"
                rules={[{ required: true, message: "请输入标题" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="description" label="简介">
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item name="tags" label="标签（逗号分隔）">
                <Input />
              </Form.Item>
              {tags.length > 0 && (
                <div className="common-tags">
                  <span>常用标签：</span>
                  {[...tags]
                    .sort((a, b) => {
                      const selected = currentTags
                        .split(",")
                        .map((x) => x.trim());
                      return (
                        Number(selected.includes(b.name)) -
                          Number(selected.includes(a.name)) ||
                        b.usageCount - a.usageCount
                      );
                    })
                    .slice(0, commonTagsExpanded ? undefined : 12)
                    .map((tag) => (
                      <Tag
                        key={tag.id}
                        color={
                          currentTags
                            .split(",")
                            .map((x) => x.trim())
                            .includes(tag.name)
                            ? "orange"
                            : "default"
                        }
                        onClick={() => appendTag(tag.name)}
                        className="clickable-tag"
                      >
                        {tag.name}
                      </Tag>
                    ))}
                  {tags.length > 12 && (
                    <Button
                      type="link"
                      size="small"
                      className="common-tags-toggle"
                      onClick={() => setCommonTagsExpanded((value) => !value)}
                    >
                      {commonTagsExpanded ? "收起" : `展开全部（${tags.length}）`}
                    </Button>
                  )}
                </div>
              )}
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true }]}
              >
                <Select
                  disabled={!editing}
                  options={[
                    { value: "published", label: "已发布" },
                    { value: "draft", label: "草稿" },
                    { value: "offline", label: "已下架" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="isAdult" label="18+" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={saving}>
                  {editing ? "保存修改" : "上传视频"}
                </Button>
                <Button onClick={close}>取消</Button>
              </Space>
            </Form>
          </Modal>
          <Modal
            open={!!nodeVideo}
            title={`精彩文字标签${nodeVideo ? ` · ${nodeVideo.title}` : ""}`}
            width={860}
            onCancel={() => setNodeVideo(undefined)}
            footer={
              <Space>
                <Button onClick={() => setNodeVideo(undefined)}>取消</Button>
                <Button
                  type="primary"
                  loading={nodeSaving}
                  onClick={async () => {
                    if (!nodeVideo) return;
                    setNodeSaving(true);
                    try {
                      await api(`/admin/videos/${nodeVideo.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ chapters: nodes }),
                      });
                      message.success("精彩标签已保存");
                      setNodeVideo(undefined);
                      load();
                    } catch (e) {
                      message.error((e as Error).message);
                    } finally {
                      setNodeSaving(false);
                    }
                  }}
                >
                  保存标签
                </Button>
              </Space>
            }
          >
            {nodeVideo && (
              <div className="node-editor">
                <video
                  ref={nodePlayer}
                  src={nodeVideo.playbackUrl}
                  poster={nodeVideo.thumbnail}
                  controls
                  playsInline
                  className="node-video"
                />
                <div className="node-add">
                  <Input
                    value={nodeLabel}
                    maxLength={12}
                    placeholder="输入文字标签，例如：精彩片段"
                    onChange={(e) => setNodeLabel(e.target.value)}
                    onPressEnter={() => {
                      const player = nodePlayer.current;
                      if (!player || !nodeLabel.trim()) return;
                      setNodes((prev) =>
                        [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            label: nodeLabel.trim(),
                            time: Number(player.currentTime.toFixed(2)),
                          },
                        ].sort((a, b) => a.time - b.time),
                      );
                      setNodeLabel("");
                    }}
                  />
                  <Button
                    type="primary"
                    onClick={() => {
                      const player = nodePlayer.current;
                      if (!player || !nodeLabel.trim())
                        return message.warning("请输入标签文字");
                      setNodes((prev) =>
                        [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            label: nodeLabel.trim(),
                            time: Number(player.currentTime.toFixed(2)),
                          },
                        ].sort((a, b) => a.time - b.time),
                      );
                      setNodeLabel("");
                    }}
                  >
                    添加到当前时间
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="node-common-tags">
                    <span>常用标签：</span>
                    {tags.slice(0, 12).map((tag) => (
                      <Tag
                        key={tag.id}
                        color="orange"
                        className="clickable-tag"
                        onClick={() => addNodeAtCurrentTime(tag.name)}
                      >
                        + {tag.name}
                      </Tag>
                    ))}
                  </div>
                )}
                <p className="node-tip">
                  先播放或拖动视频到目标位置，再输入文字并添加。
                </p>
                <div className="node-timeline">
                  {nodes.map((node) => (
                    <button
                      key={node.id}
                      className="node-bubble"
                      style={{
                        left: `${Math.max(1, Math.min(99, (node.time / nodeVideo.duration) * 100))}%`,
                      }}
                      onClick={() => {
                        if (nodePlayer.current) {
                          nodePlayer.current.currentTime = node.time;
                          void nodePlayer.current.play();
                        }
                      }}
                    >
                      {node.label}
                      <span>▼</span>
                    </button>
                  ))}
                </div>
                <div className="node-list">
                  {nodes.length === 0 ? (
                    <div className="node-empty">暂未添加精彩标签</div>
                  ) : (
                    nodes.map((node) => (
                      <div key={node.id} className="node-row">
                        <Button
                          type="link"
                          onClick={() => {
                            if (nodePlayer.current)
                              nodePlayer.current.currentTime = node.time;
                          }}
                        >
                          {Math.floor(node.time / 60)}:
                          {String(Math.floor(node.time % 60)).padStart(2, "0")}{" "}
                          · {node.label}
                        </Button>
                        <Button
                          danger
                          type="text"
                          onClick={() =>
                            setNodes((prev) =>
                              prev.filter((x) => x.id !== node.id),
                            )
                          }
                        >
                          删除
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </Modal>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
createRoot(document.getElementById("root")!).render(
  <ConfigProvider
    theme={{ token: { colorPrimary: "#f97316", borderRadius: 8 } }}
  >
    <App />
  </ConfigProvider>,
);
