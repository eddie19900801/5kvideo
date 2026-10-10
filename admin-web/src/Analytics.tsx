import { useEffect, useState } from "react";
import {
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import { api } from "./api";

type AnalyticsData = {
  days: number;
  overview: {
    activeUsers: number;
    sessions: number;
    newUsers: number;
    registeredUsers: number;
    guestUsers: number;
    impressions: number;
    plays: number;
    effectivePlays: number;
    totalWatchSeconds: number;
    favorites: number;
    shares: number;
  };
  daily: Array<{
    date: string;
    visits: number;
    uniqueVisitors: number;
    uniqueIps: number;
    newDevices: number;
    installs: number;
    guestAccounts: number;
    registeredAccounts: number;
    day1Retention: number | null;
    day3Retention: number | null;
    day7Retention: number | null;
    appUsers: number;
    h5Visits: number;
    h5Users: number;
    activeUsers: number;
    newUsers: number;
    sessions: number;
    videoImpressions: number;
    detailViews: number;
    plays: number;
    effectivePlays: number;
    completions: number;
    watchSeconds: number;
    favorites: number;
    favoriteRemovals: number;
    shares: number;
    searches: number;
    categorySelections: number;
    bufferingCount: number;
    averageStartupMs: number;
    playbackFailures: number;
  }>;
  retention: Array<{
    day: number;
    users: number;
    retained: number;
    rate: number;
  }>;
  videos: Array<{
    videoId: string;
    title: string;
    impressions: number;
    plays: number;
    effectivePlays: number;
    completions: number;
    watchSeconds: number;
    favorites: number;
    shares: number;
    ctr: number;
    completionRate: number;
    averageWatchSeconds: number;
  }>;
  searchTerms:Array<{keyword:string;count:number;users:number;share:number;lastSearchedAt:string}>;
  performance:{samples:number;slowPages:number;imageFailures:number;ttfb:PerfMetric;fcp:PerfMetric;lcp:PerfMetric;dataReady:PerfMetric;firstImage:PerfMetric;firstImages:PerfMetric;networks:Array<{network:string;samples:number;slow:number;slowRate:number;failures:number}>};
  userFeedback?: Array<{id:string;eventTime:string;videoId:string;title:string;reason:string;note:string}>;
  quality: {
    averageStartupMs: number;
    startupSamples: number;
    bufferingCount: number;
    bufferingSeconds: number;
    playbackErrors: number;
    playbackErrorTypes: Array<{key:string;label:string;count:number}>;
    playbackErrorVideos: Array<{key:string;label:string;count:number}>;
    recentPlaybackErrors: Array<{id:string;eventTime:string;videoId:string;title:string;source:string;type:string;detail:string;httpStatus:number;host:string;network:string;browser:string;elapsedMs:number;position:number}>;
    completionRate: number;
  };
  platforms: Array<{ platform: string; users: number; events: number }>;
};
type PerfMetric={samples:number;p50:number;p90:number;p95:number};

const duration = (seconds: number) =>
  seconds >= 3600
    ? `${(seconds / 3600).toFixed(1)} 小时`
    : `${Math.round(seconds / 60)} 分钟`;
const platformName = (value: string) =>
  value === "android" ? "Android" : value === "ios" ? "iOS" : "网页";

function AnalyticsPanel({ page,compact=false }: { page: string;compact?:boolean }) {
  const [days, setDays] = useState(30),
    [data, setData] = useState<AnalyticsData>(),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let active=true,first=true;
    const useCompact=compact&&page!=="analytics-videos",load=()=>{if(first)setLoading(true);void api<AnalyticsData>(`/admin/analytics?days=${days}${useCompact?"&compact=1":""}`).then(value=>{if(active)setData(value)}).catch(error=>{if(active)message.error(error.message)}).finally(()=>{if(active)setLoading(false);first=false})};
    load();const timer=window.setInterval(load,30_000);
    return()=>{active=false;window.clearInterval(timer)};
  }, [days,page,compact]);
  const extra = (
    <Space>
      <span>统计周期</span>
      <Select
        value={days}
        onChange={setDays}
        options={[
          { value: 7, label: "最近7天" },
          { value: 30, label: "最近30天" },
          { value: 90, label: "最近90天" },
          { value: 365, label: "最近一年" },
        ]}
      />
    </Space>
  );
  if (!data && !loading) return <Empty description="暂无分析数据" />;
  if (page === "analytics-daily")
    return (
      <Card title="每日数据" extra={extra}>
        <Table
          loading={loading}
          rowKey="date"
          dataSource={[...(data?.daily || [])].reverse()}
          pagination={{ pageSize: 14 }}
          scroll={{ x: 2900 }}
          columns={[
            { title: "日期", dataIndex: "date", fixed: "left", width: 110 },
            { title: "访问量(PV)", dataIndex: "visits" },
            { title: "独立访客(UV)", dataIndex: "uniqueVisitors" },
            { title: "独立IP", dataIndex: "uniqueIps" },
            { title: "新增设备", dataIndex: "newDevices" },
            { title: "APP安装", dataIndex: "installs" },
            { title: "游客账号", dataIndex: "guestAccounts" },
            { title: "注册账号", dataIndex: "registeredAccounts" },
            {
              title: "次留",
              dataIndex: "day1Retention",
              render: (value) => (value == null ? "-" : `${value}%`),
            },
            {
              title: "3日留",
              dataIndex: "day3Retention",
              render: (value) => (value == null ? "-" : `${value}%`),
            },
            {
              title: "7日留",
              dataIndex: "day7Retention",
              render: (value) => (value == null ? "-" : `${value}%`),
            },
            { title: "APP用户", dataIndex: "appUsers" },
            { title: "H5访问量", dataIndex: "h5Visits" },
            { title: "H5用户", dataIndex: "h5Users" },
            { title: "会话", dataIndex: "sessions" },
            { title: "视频曝光", dataIndex: "videoImpressions" },
            { title: "详情访问", dataIndex: "detailViews" },
            { title: "播放", dataIndex: "plays" },
            { title: "有效播放", dataIndex: "effectivePlays" },
            { title: "播放完成", dataIndex: "completions" },
            { title: "观看时长", dataIndex: "watchSeconds", render: duration },
            { title: "收藏", dataIndex: "favorites" },
            { title: "取消收藏", dataIndex: "favoriteRemovals" },
            { title: "分享", dataIndex: "shares" },
            { title: "搜索", dataIndex: "searches" },
            { title: "分类点击", dataIndex: "categorySelections" },
            { title: "缓冲次数", dataIndex: "bufferingCount" },
            { title: "平均启动", dataIndex: "averageStartupMs", render:(value)=>value?`${value} ms`:"-" },
            { title: "播放失败", dataIndex: "playbackFailures" },
          ]}
        />
      </Card>
    );
  if (page === "analytics-users")
    return (
      <>
        <Card title="用户构成" extra={extra}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="活跃用户"
                value={data?.overview.activeUsers || 0}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="游客总数"
                value={data?.overview.guestUsers || 0}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="注册用户总数"
                value={data?.overview.registeredUsers || 0}
              />
            </Col>
          </Row>
        </Card>
        <Card title="平台分布" style={{ marginTop: 16 }}>
          <Table
            loading={loading}
            pagination={false}
            rowKey="platform"
            dataSource={data?.platforms || []}
            columns={[
              {
                title: "平台",
                dataIndex: "platform",
                render: (value) => (
                  <Tag
                    color={
                      value === "web"
                        ? "blue"
                        : value === "android"
                          ? "green"
                          : "purple"
                    }
                  >
                    {platformName(value)}
                  </Tag>
                ),
              },
              { title: "活跃用户", dataIndex: "users" },
              { title: "事件数量", dataIndex: "events" },
            ]}
          />
        </Card>
      </>
    );
  if (page === "analytics-videos")
    return (
      <Card title="视频内容分析" extra={extra}>
        <Table
          loading={loading}
          rowKey="videoId"
          dataSource={data?.videos || []}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1300 }}
          columns={[
            {
              title: "视频",
              dataIndex: "title",
              fixed: "left",
              width: 260,
              ellipsis: true,
            },
            { title: "曝光", dataIndex: "impressions" },
            { title: "播放", dataIndex: "plays" },
            {
              title: "点击率",
              dataIndex: "ctr",
              render: (value) => `${value}%`,
            },
            { title: "10秒有效播放", dataIndex: "effectivePlays" },
            { title: "完播", dataIndex: "completions" },
            {
              title: "完播率",
              dataIndex: "completionRate",
              render: (value) => `${value}%`,
            },
            {
              title: "平均观看",
              dataIndex: "averageWatchSeconds",
              render: (value) => `${value} 秒`,
            },
            { title: "总观看", dataIndex: "watchSeconds", render: duration },
            { title: "收藏", dataIndex: "favorites" },
            { title: "分享", dataIndex: "shares" },
          ]}
        />
      </Card>
    );
  if(page==="analytics-searches")return <Card title="用户搜索排行" extra={extra}><Table loading={loading} rowKey="keyword" dataSource={data?.searchTerms||[]} pagination={{pageSize:30}} columns={[{title:"关键词",dataIndex:"keyword",fixed:"left",width:260},{title:"搜索次数",dataIndex:"count",sorter:(a,b)=>a.count-b.count,defaultSortOrder:"descend"},{title:"搜索用户",dataIndex:"users",sorter:(a,b)=>a.users-b.users},{title:"占比",dataIndex:"share",render:value=>`${value}%`},{title:"最近搜索",dataIndex:"lastSearchedAt",render:value=>new Date(value).toLocaleString("zh-CN")}]} scroll={{x:800}}/></Card>;
  if(page==="analytics-performance"){const report=data?.performance,metrics=[{name:"服务器响应 TTFB",value:report?.ttfb},{name:"首次内容 FCP",value:report?.fcp},{name:"主要内容 LCP",value:report?.lcp},{name:"视频数据出现",value:report?.dataReady},{name:"第一张封面",value:report?.firstImage},{name:"首屏4张封面",value:report?.firstImages}];return <><Row gutter={[16,16]}><Col span={8}><Card><Statistic title="采样页面" value={report?.samples||0}/></Card></Col><Col span={8}><Card><Statistic title="慢页面" value={report?.slowPages||0} suffix={report?.samples?` / ${(report.slowPages/report.samples*100).toFixed(1)}%`:""}/></Card></Col><Col span={8}><Card><Statistic title="图片失败" value={report?.imageFailures||0}/></Card></Col></Row><Card title="加载时间分位数（毫秒）" extra={extra} style={{marginTop:16}}><Table rowKey="name" pagination={false} dataSource={metrics} columns={[{title:"指标",dataIndex:"name"},{title:"样本",render:(_,row)=>row.value?.samples||0},{title:"P50",render:(_,row)=>`${row.value?.p50||0} ms`},{title:"P90",render:(_,row)=>`${row.value?.p90||0} ms`},{title:"P95",render:(_,row)=>`${row.value?.p95||0} ms`}]} /></Card><Card title="网络环境" style={{marginTop:16}}><Table rowKey="network" pagination={false} dataSource={report?.networks||[]} columns={[{title:"网络",dataIndex:"network"},{title:"样本",dataIndex:"samples"},{title:"慢页面",dataIndex:"slow"},{title:"慢页面比例",dataIndex:"slowRate",render:value=>`${value}%`},{title:"图片失败",dataIndex:"failures"}]}/></Card></>}
  if (page === "analytics-retention")
    return (
      <Card title="用户留存" extra={extra}>
        <Table
          loading={loading}
          pagination={false}
          rowKey="day"
          dataSource={data?.retention || []}
          columns={[
            {
              title: "留存周期",
              dataIndex: "day",
              render: (value) => `第 ${value} 天`,
            },
            { title: "可统计用户", dataIndex: "users" },
            { title: "回访用户", dataIndex: "retained" },
            {
              title: "留存率",
              dataIndex: "rate",
              render: (value) => (
                <Tag
                  color={
                    value >= 20 ? "green" : value >= 10 ? "orange" : "default"
                  }
                >
                  {value}%
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    );
  if (page === "analytics-quality")
    return (
      <><Card title="播放质量" extra={extra}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="平均首帧时间"
                value={data?.quality.averageStartupMs || 0}
                suffix="ms"
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="卡顿次数"
                value={data?.quality.bufferingCount || 0}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="播放错误"
                value={data?.quality.playbackErrors || 0}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="卡顿累计"
                value={data?.quality.bufferingSeconds || 0}
                suffix="秒"
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="完播率"
                value={data?.quality.completionRate || 0}
                suffix="%"
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="首帧样本"
                value={data?.quality.startupSamples || 0}
              />
            </Card>
          </Col>
        </Row>
      </Card>
      <Row gutter={[16,16]} style={{marginTop:16}}>
        <Col xs={24} xl={12}><Card title="错误类型排行"><Table size="small" rowKey="key" pagination={false} dataSource={data?.quality.playbackErrorTypes||[]} columns={[{title:"错误",dataIndex:"label",ellipsis:true},{title:"次数",dataIndex:"count",width:80}]}/></Card></Col>
        <Col xs={24} xl={12}><Card title="错误视频排行"><Table size="small" rowKey="key" pagination={false} dataSource={data?.quality.playbackErrorVideos||[]} columns={[{title:"视频",dataIndex:"label",ellipsis:true},{title:"视频ID",dataIndex:"key",ellipsis:true,width:150},{title:"次数",dataIndex:"count",width:80}]}/></Card></Col>
      </Row>
      <Card title="用户问题反馈（当前查询时间范围，最多100条）" style={{marginTop:16}}><Table size="small" rowKey="id" dataSource={data?.userFeedback||[]} pagination={{pageSize:10}} scroll={{x:900}} columns={[{title:"时间",dataIndex:"eventTime",width:180,render:value=>new Date(value).toLocaleString("zh-CN")},{title:"视频ID",dataIndex:"videoId",width:100},{title:"视频",dataIndex:"title",width:240},{title:"问题",dataIndex:"reason",width:120},{title:"说明",dataIndex:"note",width:280}]}/></Card>
      <Card title="最近播放错误（保留最近30天，最多显示100条）" style={{marginTop:16}}><Table size="small" rowKey="id" dataSource={data?.quality.recentPlaybackErrors||[]} pagination={{pageSize:20}} scroll={{x:1600}} columns={[{title:"时间",dataIndex:"eventTime",width:180,fixed:"left",render:value=>new Date(value).toLocaleString("zh-CN")},{title:"视频",dataIndex:"title",width:240,ellipsis:true},{title:"错误类型",dataIndex:"type",width:170,ellipsis:true},{title:"具体错误",dataIndex:"detail",width:190,ellipsis:true},{title:"HTTP",dataIndex:"httpStatus",width:80,render:value=>value||"-"},{title:"播放域名",dataIndex:"host",width:190,ellipsis:true},{title:"网络",dataIndex:"network",width:90},{title:"出错耗时",dataIndex:"elapsedMs",width:110,render:value=>`${value} ms`},{title:"播放位置",dataIndex:"position",width:100,render:value=>`${value} 秒`},{title:"来源",dataIndex:"source",width:90},{title:"浏览器",dataIndex:"browser",width:300,ellipsis:true}]}/></Card></>
    );
  const overview = data?.overview;
  return (
    <Card title="数据分析总览" extra={extra}>
      <Row gutter={[16, 16]}>
        {[
          { title: "活跃用户", value: overview?.activeUsers },
          { title: "新增用户", value: overview?.newUsers },
          { title: "会话次数", value: overview?.sessions },
          { title: "视频曝光", value: overview?.impressions },
          { title: "播放次数", value: overview?.plays },
          { title: "10秒有效播放", value: overview?.effectivePlays },
          {
            title: "总观看时长",
            value: duration(overview?.totalWatchSeconds || 0),
          },
          { title: "收藏", value: overview?.favorites },
          { title: "分享", value: overview?.shares },
        ].map((item) => (
          <Col xs={12} md={8} xl={6} key={item.title}>
            <Card loading={loading}>
              <Statistic title={item.title} value={item.value || 0} />
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

export default function Analytics({compact=false}:{compact?:boolean}) {
  const [page, setPage] = useState("analytics-daily");
  const tabs = [
    { key: "analytics-overview", label: "分析总览" },
    { key: "analytics-daily", label: "每日趋势" },
    { key: "analytics-users", label: "用户分析" },
    { key: "analytics-videos", label: "视频分析" },
    { key: "analytics-searches", label: "搜索分析" },
    { key: "analytics-performance", label: "性能分析" },
    { key: "analytics-retention", label: "留存分析" },
    { key: "analytics-quality", label: "播放质量" },
  ];
  return (
    <>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Tabs activeKey={page} onChange={setPage} items={tabs} />
      </Card>
      <div style={{ marginTop: 16 }}>
      <AnalyticsPanel page={page} compact={compact} />
      </div>
    </>
  );
}
