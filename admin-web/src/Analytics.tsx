import { useEffect, useState } from "react";
import { Card, Col, Empty, Row, Select, Space, Statistic, Table, Tabs, Tag, message } from "antd";
import { api } from "./api";

type AnalyticsData = {
  days:number;
  overview:{activeUsers:number;sessions:number;newUsers:number;registeredUsers:number;guestUsers:number;impressions:number;plays:number;effectivePlays:number;totalWatchSeconds:number;favorites:number;shares:number};
  daily:Array<{date:string;activeUsers:number;newUsers:number;sessions:number;videoImpressions:number;plays:number;effectivePlays:number;watchSeconds:number;favorites:number;shares:number;playbackFailures:number}>;
  retention:Array<{day:number;users:number;retained:number;rate:number}>;
  videos:Array<{videoId:string;title:string;impressions:number;plays:number;effectivePlays:number;completions:number;watchSeconds:number;favorites:number;shares:number;ctr:number;completionRate:number;averageWatchSeconds:number}>;
  quality:{averageStartupMs:number;startupSamples:number;bufferingCount:number;bufferingSeconds:number;playbackErrors:number;completionRate:number};
  platforms:Array<{platform:string;users:number;events:number}>;
};

const duration=(seconds:number)=>seconds>=3600?`${(seconds/3600).toFixed(1)} 小时`:`${Math.round(seconds/60)} 分钟`;
const platformName=(value:string)=>value==="android"?"Android":value==="ios"?"iOS":"网页";

function AnalyticsPanel({page}:{page:string}){
  const [days,setDays]=useState(30),[data,setData]=useState<AnalyticsData>(),[loading,setLoading]=useState(false);
  useEffect(()=>{setLoading(true);void api<AnalyticsData>(`/admin/analytics?days=${days}`).then(setData).catch(error=>message.error(error.message)).finally(()=>setLoading(false))},[days]);
  const extra=<Space><span>统计周期</span><Select value={days} onChange={setDays} options={[{value:7,label:"最近7天"},{value:30,label:"最近30天"},{value:90,label:"最近90天"},{value:365,label:"最近一年"}]}/></Space>;
  if(!data&&!loading)return <Empty description="暂无分析数据"/>;
  if(page==="analytics-daily")return <Card title="每日趋势" extra={extra}><Table loading={loading} rowKey="date" dataSource={[...(data?.daily||[])].reverse()} pagination={{pageSize:14}} scroll={{x:1100}} columns={[{title:"日期",dataIndex:"date",fixed:"left"},{title:"活跃用户",dataIndex:"activeUsers"},{title:"新增用户",dataIndex:"newUsers"},{title:"会话",dataIndex:"sessions"},{title:"视频曝光",dataIndex:"videoImpressions"},{title:"播放",dataIndex:"plays"},{title:"有效播放",dataIndex:"effectivePlays"},{title:"观看时长",dataIndex:"watchSeconds",render:duration},{title:"收藏",dataIndex:"favorites"},{title:"分享",dataIndex:"shares"},{title:"播放失败",dataIndex:"playbackFailures"}]}/></Card>;
  if(page==="analytics-users")return <><Card title="用户构成" extra={extra}><Row gutter={[16,16]}><Col span={8}><Statistic title="活跃用户" value={data?.overview.activeUsers||0}/></Col><Col span={8}><Statistic title="游客总数" value={data?.overview.guestUsers||0}/></Col><Col span={8}><Statistic title="注册用户总数" value={data?.overview.registeredUsers||0}/></Col></Row></Card><Card title="平台分布" style={{marginTop:16}}><Table loading={loading} pagination={false} rowKey="platform" dataSource={data?.platforms||[]} columns={[{title:"平台",dataIndex:"platform",render:(value)=><Tag color={value==="web"?"blue":value==="android"?"green":"purple"}>{platformName(value)}</Tag>},{title:"活跃用户",dataIndex:"users"},{title:"事件数量",dataIndex:"events"}]}/></Card></>;
  if(page==="analytics-videos")return <Card title="视频内容分析" extra={extra}><Table loading={loading} rowKey="videoId" dataSource={data?.videos||[]} pagination={{pageSize:20}} scroll={{x:1300}} columns={[{title:"视频",dataIndex:"title",fixed:"left",width:260,ellipsis:true},{title:"曝光",dataIndex:"impressions"},{title:"播放",dataIndex:"plays"},{title:"点击率",dataIndex:"ctr",render:value=>`${value}%`},{title:"10秒有效播放",dataIndex:"effectivePlays"},{title:"完播",dataIndex:"completions"},{title:"完播率",dataIndex:"completionRate",render:value=>`${value}%`},{title:"平均观看",dataIndex:"averageWatchSeconds",render:value=>`${value} 秒`},{title:"总观看",dataIndex:"watchSeconds",render:duration},{title:"收藏",dataIndex:"favorites"},{title:"分享",dataIndex:"shares"}]}/></Card>;
  if(page==="analytics-retention")return <Card title="用户留存" extra={extra}><Table loading={loading} pagination={false} rowKey="day" dataSource={data?.retention||[]} columns={[{title:"留存周期",dataIndex:"day",render:value=>`第 ${value} 天`},{title:"可统计用户",dataIndex:"users"},{title:"回访用户",dataIndex:"retained"},{title:"留存率",dataIndex:"rate",render:value=><Tag color={value>=20?"green":value>=10?"orange":"default"}>{value}%</Tag>}]}/></Card>;
  if(page==="analytics-quality")return <Card title="播放质量" extra={extra}><Row gutter={[16,16]}><Col xs={24} md={8}><Card><Statistic title="平均首帧时间" value={data?.quality.averageStartupMs||0} suffix="ms"/></Card></Col><Col xs={24} md={8}><Card><Statistic title="卡顿次数" value={data?.quality.bufferingCount||0}/></Card></Col><Col xs={24} md={8}><Card><Statistic title="播放错误" value={data?.quality.playbackErrors||0}/></Card></Col><Col xs={24} md={8}><Card><Statistic title="卡顿累计" value={data?.quality.bufferingSeconds||0} suffix="秒"/></Card></Col><Col xs={24} md={8}><Card><Statistic title="完播率" value={data?.quality.completionRate||0} suffix="%"/></Card></Col><Col xs={24} md={8}><Card><Statistic title="首帧样本" value={data?.quality.startupSamples||0}/></Card></Col></Row></Card>;
  const overview=data?.overview;
  return <Card title="数据分析总览" extra={extra}><Row gutter={[16,16]}>{[{title:"活跃用户",value:overview?.activeUsers},{title:"新增用户",value:overview?.newUsers},{title:"会话次数",value:overview?.sessions},{title:"视频曝光",value:overview?.impressions},{title:"播放次数",value:overview?.plays},{title:"10秒有效播放",value:overview?.effectivePlays},{title:"总观看时长",value:duration(overview?.totalWatchSeconds||0)},{title:"收藏",value:overview?.favorites},{title:"分享",value:overview?.shares}].map(item=><Col xs={12} md={8} xl={6} key={item.title}><Card loading={loading}><Statistic title={item.title} value={item.value||0}/></Card></Col>)}</Row></Card>;
}

export default function Analytics(){
  const [page,setPage]=useState("analytics-overview");
  const tabs=[
    {key:"analytics-overview",label:"分析总览"},
    {key:"analytics-daily",label:"每日趋势"},
    {key:"analytics-users",label:"用户分析"},
    {key:"analytics-videos",label:"视频分析"},
    {key:"analytics-retention",label:"留存分析"},
    {key:"analytics-quality",label:"播放质量"},
  ];
  return <><Card styles={{body:{paddingBottom:0}}}><Tabs activeKey={page} onChange={setPage} items={tabs}/></Card><div style={{marginTop:16}}><AnalyticsPanel page={page}/></div></>;
}
