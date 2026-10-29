import { useEffect, useState } from "react";
import { Button, Card, Input, Space, Switch, Table, Tag, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { api } from "./api";

type Source={id:string;key:string;name:string;endpoint:string;fallbackEndpoint?:string;enabled:boolean;videoCount:number;updatedAt:string};
export default function CollectorSources(){
  const[rows,setRows]=useState<Source[]>([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState("");
  const load=async()=>{setLoading(true);try{setRows(await api<Source[]>("/admin/collectors/sources"))}catch(error){message.error((error as Error).message)}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  const update=async(row:Source,patch:{name?:string;enabled?:boolean})=>{setSaving(row.id);try{await api(`/admin/collectors/sources/${row.id}`,{method:"PATCH",body:JSON.stringify(patch)});message.success("片源配置已更新");await load()}catch(error){message.error((error as Error).message)}finally{setSaving("")}};
  return <Card title="片源配置" extra={<Button icon={<ReloadOutlined/>} onClick={()=>void load()}>刷新</Button>}>
    <Typography.Paragraph type="secondary">片源相互独立，资源以“片源编号 + 远程ID”去重。停用后不再更新该片源，已经采集的资源不会被删除。</Typography.Paragraph>
    <Table rowKey="id" loading={loading} dataSource={rows} pagination={false} columns={[
      {title:"片源名称",dataIndex:"name",width:220,render:(value,row)=><Input defaultValue={value} maxLength={50} onPressEnter={event=>void update(row,{name:event.currentTarget.value.trim()})}/>},
      {title:"片源编号",dataIndex:"key",width:190,render:value=><Tag>{value}</Tag>},
      {title:"采集接口",dataIndex:"endpoint",render:value=><Typography.Text copyable ellipsis style={{maxWidth:520}}>{value}</Typography.Text>},
      {title:"备用接口",dataIndex:"fallbackEndpoint",render:value=>value?<Typography.Text copyable ellipsis style={{maxWidth:360}}>{value}</Typography.Text>:"-"},
      {title:"目录资源",dataIndex:"videoCount",width:110,render:value=>`${value} 条`},
      {title:"启用",dataIndex:"enabled",width:100,render:(value,row)=><Space><Switch checked={value} loading={saving===row.id} onChange={checked=>void update(row,{enabled:checked})}/></Space>},
    ]} scroll={{x:1250}}/>
  </Card>
}
