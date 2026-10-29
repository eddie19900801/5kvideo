import { useEffect, useRef, useState } from "react";
import { Button, Card, Descriptions, Image, Input, Modal, Popconfirm, Select, Space, Spin, Table, Tag, Typography, message } from "antd";
import { CaretDownOutlined, CaretRightOutlined, CaretUpOutlined, CloudDownloadOutlined, MergeCellsOutlined, PauseCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import Hls from "hls.js";
import { api, token } from "./api";

type RemoteVideo = {
  id: string;
  remoteId: string;
  sourceKey:string;
  sourceName:string;
  title: string;
  category: string;
  categoryId: string;
  thumbnail: string;
  duration: string;
  updatedAt: string;
  remarks: string;
  playable: boolean;
  collected: boolean;
  imported: boolean;
  previewCount: number;
  previewStatus: "idle" | "processing" | "ready" | "failed";
};

type CollectedDetail = {
  id:string;remoteId: string;sourceKey:string;sourceName:string; title: string; description: string; thumbnail: string; playbackUrl: string;
  duration: number; category: string; categoryId: string; tags: string[]; updatedAt: string; importedAt: string;
  collected: boolean; imported: boolean; trimStart: number; trimEnd: number;
};
type PreviewItem={id:string;time:number;slot:number;image:string;createdAt:string};
type PreviewResult={status:"idle"|"processing"|"ready"|"failed";error?:string;items:PreviewItem[]};
type QueueStatus={paused:boolean;queued:number;running:number;completed:number;failed:number;concurrency:number};
type SyncStatus={running:boolean;lastStartedAt?:string;lastFinishedAt?:string;nextRunAt:string;checkedPages:number;added:number;updated:number;total:number;error?:string};
type CollectorCategory={id:string;name:string;count:number;createdAt:string};
type CollectorSource={id:string;key:string;name:string;enabled:boolean;videoCount:number};

function PreviewImage({src}:{src:string}){const[url,setUrl]=useState("");useEffect(()=>{let objectUrl="",cancelled=false;void fetch(src,{headers:{Authorization:`Bearer ${token()}`}}).then(response=>{if(!response.ok)throw new Error();return response.blob()}).then(blob=>{objectUrl=URL.createObjectURL(blob);if(!cancelled)setUrl(objectUrl)}).catch(()=>{});return()=>{cancelled=true;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[src]);return url?<img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Spin size="small"/>}

function CollectedPlayer({ url, trimStart, trimEnd, seekTime }: { url: string; trimStart: number; trimEnd: number; seekTime?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const enforceTrim = () => {
      if (trimStart > 0 && video.currentTime < trimStart) video.currentTime = trimStart;
      if (trimEnd > 0 && Number.isFinite(video.duration) && video.currentTime >= video.duration - trimEnd) video.pause();
    };
    video.addEventListener("loadedmetadata", enforceTrim);
    video.addEventListener("timeupdate", enforceTrim);
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) message.error("远程视频加载失败，请检查 M3U8 是否仍然有效");
      });
      return () => { video.removeEventListener("loadedmetadata", enforceTrim); video.removeEventListener("timeupdate", enforceTrim); hls.destroy(); };
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = url;
    else message.error("当前浏览器不支持 HLS 播放");
    return () => { video.removeEventListener("loadedmetadata", enforceTrim); video.removeEventListener("timeupdate", enforceTrim); };
  }, [url, trimStart, trimEnd]);
  useEffect(()=>{const video=ref.current;if(video&&seekTime!==undefined){video.currentTime=seekTime+trimStart;void video.play().catch(()=>{})}},[seekTime,trimStart]);
  return <video ref={ref} controls autoPlay playsInline style={{ width: "100%", maxHeight: 430, background: "#000", borderRadius: 8 }} />;
}

type RemotePage = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  items: RemoteVideo[];
};

export default function CollectorManager({ onImported }: { onImported?: () => void }) {
  const [data, setData] = useState<RemotePage>({ page: 1, pageCount: 1, pageSize: 20, total: 0, items: [] });
  const [keyword, setKeyword] = useState("");
  const [category,setCategory]=useState("");
  const [source,setSource]=useState("");
  const [sources,setSources]=useState<CollectorSource[]>([]);
  const [categories,setCategories]=useState<CollectorCategory[]>([]);
  const [newCategory,setNewCategory]=useState("");
  const [assignCategory,setAssignCategory]=useState<string>();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [detail, setDetail] = useState<CollectedDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [previews,setPreviews]=useState<PreviewResult>({status:"idle",items:[]});
  const [previewSeek,setPreviewSeek]=useState<number>();
  const [queue,setQueue]=useState<QueueStatus>({paused:false,queued:0,running:0,completed:0,failed:0,concurrency:2});
  const [batching,setBatching]=useState(false);
  const [sync,setSync]=useState<SyncStatus>({running:false,nextRunAt:"",checkedPages:0,added:0,updated:0,total:0});

  const load = async (page = 1, search = keyword, selectedCategory = category,selectedSource=source) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (search.trim()) query.set("keyword", search.trim());
      if(selectedCategory)query.set("category",selectedCategory);
      if(selectedSource)query.set("source",selectedSource);
      setData(await api<RemotePage>(`/admin/collectors/remote?${query}`));
      setSelected([]);
    } catch (error) { message.error((error as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(1, ""); }, []);
  const loadCategories=()=>api<CollectorCategory[]>("/admin/collectors/categories").then(setCategories);
  useEffect(()=>{void loadCategories().catch(()=>{})},[]);
  useEffect(()=>{void api<CollectorSource[]>("/admin/collectors/sources").then(setSources).catch(()=>{})},[]);
  useEffect(()=>{let stopped=false;const refresh=()=>void api<QueueStatus>("/admin/collectors/preview-jobs").then(value=>{if(!stopped)setQueue(value)}).catch(()=>{});refresh();const timer=setInterval(refresh,5000);return()=>{stopped=true;clearInterval(timer)}},[]);
  useEffect(()=>{let stopped=false;const refresh=()=>void api<SyncStatus>("/admin/collectors/sync").then(value=>{if(!stopped)setSync(value)}).catch(()=>{});refresh();const timer=setInterval(refresh,10000);return()=>{stopped=true;clearInterval(timer)}},[]);

  const batchPreviews=async(ids?:string[])=>{setBatching(true);try{const result=await api<{requested:number;enqueued:number;skipped:number;queue:QueueStatus}>("/admin/collectors/preview-jobs/batch",{method:"POST",body:JSON.stringify(ids?.length?{ids,limit:ids.length}:{keyword:keyword.trim(),limit:500})});setQueue(result.queue);message.success(`已加入 ${result.enqueued} 条，跳过 ${result.skipped} 条，后台将慢慢生成`)}catch(error){message.error((error as Error).message)}finally{setBatching(false)}};
  const controlQueue=async(action:"pause"|"resume")=>{try{setQueue(await api<QueueStatus>("/admin/collectors/preview-jobs/control",{method:"POST",body:JSON.stringify({action})}));message.success(action==="pause"?"已暂停接收新任务执行，当前任务完成后停止":"后台任务已继续") }catch(error){message.error((error as Error).message)}};
  const runSync=async()=>{try{setSync(value=>({...value,running:true,error:undefined}));setSync(await api<SyncStatus>("/admin/collectors/sync",{method:"POST"}));message.success("采集任务已开始，将在后台增量同步")}catch(error){message.error((error as Error).message);setSync(value=>({...value,running:false}))}};

  const importIds = async (ids: string[]) => {
    if (!ids.length) return;
    setImporting(true);
    try {
      const result = await api<{ imported: number; skipped: number; failed: { remoteId: string; reason: string }[] }>("/admin/collectors/import", {
        method: "POST", body: JSON.stringify({ ids }),
      });
      message.success(`成功采集 ${result.imported} 条，跳过 ${result.skipped} 条，失败 ${result.failed.length} 条`);
      if (result.failed.length) message.warning(result.failed.slice(0, 3).map(item => `${item.remoteId}：${item.reason}`).join("；"));
      await load(data.page);
      onImported?.();
    } catch (error) { message.error((error as Error).message); }
    finally { setImporting(false); }
  };

  const showDetail = async (remoteId: string, play = false) => {
    setDetailLoading(true);
    try {
      setDetail(await api<CollectedDetail>(`/admin/collectors/remote/${encodeURIComponent(remoteId)}`));
      setPreviews(await api<PreviewResult>(`/admin/collectors/remote/${encodeURIComponent(remoteId)}/previews`));
      setPlaying(play);
    }
    catch (error) { message.error((error as Error).message); }
    finally { setDetailLoading(false); }
  };
  useEffect(()=>{if(!detail||previews.status!=="processing")return;const timer=setInterval(()=>void api<PreviewResult>(`/admin/collectors/remote/${encodeURIComponent(detail.id)}/previews`).then(setPreviews).catch(()=>{}),2500);return()=>clearInterval(timer)},[detail,previews.status]);
  const generatePreviews=async(replace=false)=>{if(!detail)return;try{setPreviews(await api<PreviewResult>(`/admin/collectors/remote/${encodeURIComponent(detail.id)}/previews${replace?"?replace=1":""}`,{method:"POST"}));message.success("预览截图任务已开始")}catch(error){message.error((error as Error).message)}};
  const deletePreview=async(id:string)=>{if(!detail)return;try{setPreviews(await api<PreviewResult>(`/admin/collectors/remote/${encodeURIComponent(detail.id)}/previews/${encodeURIComponent(id)}`,{method:"DELETE"}));message.success("已删除，正在自动补充")}catch(error){message.error((error as Error).message)}};
  const createCategory=async()=>{if(!newCategory.trim())return;try{await api('/admin/collectors/categories',{method:'POST',body:JSON.stringify({name:newCategory.trim()})});setNewCategory('');await loadCategories();message.success('采集分类已添加')}catch(error){message.error((error as Error).message)}};
  const renameCategory=async(item:CollectorCategory)=>{const name=window.prompt('修改采集分类名称',item.name)?.trim();if(!name||name===item.name)return;try{await api(`/admin/collectors/categories/${item.id}`,{method:'PATCH',body:JSON.stringify({name})});await loadCategories();await load(data.page);message.success('分类已修改')}catch(error){message.error((error as Error).message)}};
  const removeCategory=async(id:string)=>{try{await api(`/admin/collectors/categories/${id}`,{method:'DELETE'});if(category===id)setCategory('');await loadCategories();await load(1,keyword,category===id?'':category);message.success('分类已删除，原视频变为未分类')}catch(error){message.error((error as Error).message)}};
  const moveCategory=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=categories.length)return;const ordered=[...categories];[ordered[index],ordered[next]]=[ordered[next],ordered[index]];try{await api('/admin/collectors/categories/order',{method:'PUT',body:JSON.stringify({ids:ordered.map(item=>item.id)})});setCategories(ordered);message.success('分类顺序已保存')}catch(error){message.error((error as Error).message)}};
  const mergeCategory=(item:CollectorCategory)=>{const targets=categories.filter(category=>category.id!==item.id);if(!targets.length)return;let targetId=targets[0].id;Modal.confirm({title:`合并“${item.name}”`,content:<Space direction="vertical" style={{width:'100%'}}><Typography.Text>该分类下的视频将移动到目标分类，源分类随后删除。</Typography.Text><Select defaultValue={targetId} style={{width:'100%'}} options={targets.map(target=>({label:`${target.name}（${target.count}）`,value:target.id}))} onChange={value=>{targetId=value}}/></Space>,okText:'确认合并',cancelText:'取消',onOk:async()=>{try{await api(`/admin/collectors/categories/${item.id}/merge`,{method:'POST',body:JSON.stringify({targetId})});if(category===item.id)setCategory(targetId);await Promise.all([loadCategories(),load(1,keyword,category===item.id?targetId:category)]);message.success('分类已合并')}catch(error){message.error((error as Error).message);throw error}}})};
  const assignVideos=async(ids:string[],categoryId:string|null)=>{if(!ids.length)return;try{await api('/admin/collectors/category-assignment',{method:'PATCH',body:JSON.stringify({ids,categoryId})});setSelected([]);await Promise.all([load(data.page),loadCategories()]);if(detail&&ids.includes(detail.id))setDetail(await api<CollectedDetail>(`/admin/collectors/remote/${encodeURIComponent(detail.id)}`));message.success(categoryId?'视频分类已设置':'已取消视频分类')}catch(error){message.error((error as Error).message)}};

  return (
    <Card
      title="采集视频管理"
      extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load(data.page)}>刷新</Button>}
    >
      <Typography.Paragraph type="secondary">
        当前使用 M3U8 线路。采集后保存为草稿并使用远程封面、远程视频，不上传 R2；请检查内容和播放状态后再发布。
      </Typography.Paragraph>
      <Card size="small" style={{marginBottom:16}} title="每日自动采集" extra={<Button size="small" loading={sync.running} onClick={()=>void runSync()}>立即采集一次</Button>}>
        <Space wrap><Tag color={sync.running?"processing":"green"}>{sync.running?"采集中":"已启用"}</Tag><span>每天 03:00（曼谷时间）</span><span>下次：{sync.nextRunAt?new Date(sync.nextRunAt).toLocaleString():"-"}</span><span>上次新增：{sync.added}</span><span>更新：{sync.updated}</span><span>目录总数：{sync.total||data.total}</span>{sync.error&&<Tag color="error">{sync.error}</Tag>}</Space>
      </Card>
      <Card size="small" style={{marginBottom:16}} title="截图后台任务" extra={<Button size="small" icon={queue.paused?undefined:<PauseCircleOutlined/>} onClick={()=>void controlQueue(queue.paused?"resume":"pause")}>{queue.paused?"继续任务":"暂停任务"}</Button>}>
        <Space wrap><Tag color={queue.paused?"orange":"processing"}>{queue.paused?"已暂停":"运行中"}</Tag><span>正在处理：{queue.running}/{queue.concurrency}</span><span>等待：{queue.queued}</span><span>已完成：{queue.completed}</span><span>失败：{queue.failed}</span></Space>
      </Card>
      <Card size="small" style={{marginBottom:16}} title="采集视频分类" extra={<Space.Compact><Input value={newCategory} maxLength={30} placeholder="新增分类" onChange={event=>setNewCategory(event.target.value)} onPressEnter={()=>void createCategory()}/><Button type="primary" onClick={()=>void createCategory()} disabled={!newCategory.trim()}>添加</Button></Space.Compact>}>
        <Space wrap align="start">{categories.map((item,index)=><Space.Compact key={item.id}><Button size="small" onClick={()=>void renameCategory(item)}>{item.name}（{item.count}）</Button><Button size="small" icon={<CaretUpOutlined/>} disabled={index===0} title="上移" onClick={()=>void moveCategory(index,-1)}/><Button size="small" icon={<CaretDownOutlined/>} disabled={index===categories.length-1} title="下移" onClick={()=>void moveCategory(index,1)}/><Button size="small" icon={<MergeCellsOutlined/>} title="合并到其他分类" onClick={()=>mergeCategory(item)}/><Popconfirm title={`删除“${item.name}”？`} description="删除后源分类不会被自动重新创建，视频会变为未分类。" onConfirm={()=>void removeCategory(item.id)}><Button size="small" danger>删除</Button></Popconfirm></Space.Compact>)}</Space>
        <Typography.Text type="secondary" style={{display:'block',marginTop:8}}>新片源分类会自动创建并归类；人工改名、合并和排序会永久保留，不会被后续同步覆盖。</Typography.Text>
      </Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear value={keyword} style={{ width: 360 }} placeholder="搜索资源站标题"
          onChange={event => setKeyword(event.target.value)} onSearch={value => void load(1, value)}
        />
        <Select
          value={category} style={{width:220}} placeholder="采集视频分类"
          options={[{label:"全部分类",value:""},...categories.map(item=>({label:`${item.name}（${item.count}）`,value:item.id}))]}
          onChange={value=>{setCategory(value);void load(1,keyword,value)}}
        />
        <Select value={source} style={{width:220}} options={[{label:"全部片源",value:""},...sources.map(item=>({label:`${item.name}（${item.videoCount}）`,value:item.key}))]} onChange={value=>{setSource(value);void load(1,keyword,category,value)}}/>
        <Button
          type="primary" icon={<CloudDownloadOutlined />} loading={importing}
          disabled={!selected.length} onClick={() => void importIds(selected.map(String))}
        >批量采集（{selected.length}）</Button>
        <Button loading={batching} disabled={!selected.length} onClick={()=>void batchPreviews(selected.map(String))}>选中视频生成截图（{selected.length}）</Button>
        <Select value={assignCategory} allowClear style={{width:180}} placeholder="选择要分配的分类" options={categories.map(item=>({label:item.name,value:item.id}))} onChange={setAssignCategory}/>
        <Button disabled={!selected.length||!assignCategory} onClick={()=>void assignVideos(selected.map(String),assignCategory||null)}>批量设置分类</Button>
        <Button disabled={!selected.length} onClick={()=>void assignVideos(selected.map(String),null)}>取消分类</Button>
        <Popconfirm title={keyword.trim()?`为“${keyword.trim()}”搜索结果中的前 500 条补充截图？`:"为采集目录前 500 条缺少截图的视频加入后台任务？"} onConfirm={()=>void batchPreviews()}>
          <Button loading={batching}>当前筛选批量生成（最多500）</Button>
        </Popconfirm>
      </Space>
      <Table<RemoteVideo>
        rowKey="id" loading={loading} dataSource={data.items}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: setSelected,
          getCheckboxProps: row => ({ disabled: !row.playable }),
        }}
        pagination={{ current: data.page, pageSize: data.pageSize, total: data.total, showSizeChanger: false, showTotal: total => `共 ${total} 条`, onChange: page => void load(page) }}
        columns={[
          { title: "资源站 ID", dataIndex: "remoteId", width: 105 },
          { title: "片源", dataIndex: "sourceName", width: 150 },
          { title: "封面", dataIndex: "thumbnail", width: 88, render: value => <img src={value} referrerPolicy="no-referrer" style={{ width: 56, height: 74, objectFit: "cover", borderRadius: 4 }} /> },
          { title: "标题", dataIndex: "title", ellipsis: true, render: (value, row) => <Button type="link" style={{ padding: 0, height: "auto", textAlign: "left" }} onClick={() => void showDetail(row.id)}>{value}</Button> },
          { title: "分类", dataIndex: "category", width: 150, render: (value,row) => <Select size="small" allowClear value={row.categoryId||undefined} placeholder="未分类" style={{width:130}} options={categories.map(item=>({label:item.name,value:item.id}))} onChange={value=>void assignVideos([row.id],value||null)}/> },
          { title: "时长", dataIndex: "duration", width: 90, render: value => value || "未知" },
          { title: "更新时间", dataIndex: "updatedAt", width: 170 },
          { title: "截图数量", dataIndex: "previewCount", width: 105, render: (value, row) => <Space size={4}><span>{value || 0}</span>{row.previewStatus === "processing" && <Tag color="processing">生成中</Tag>}{row.previewStatus === "failed" && <Tag color="error">失败</Tag>}</Space> },
          { title: "状态", width: 170, render: (_, row) => <Space size={4} wrap>{row.collected && <Tag color="green">已采集</Tag>}{row.imported ? <Tag color="blue">已入视频库</Tag> : row.playable ? <Tag>未入视频库</Tag> : <Tag color="red">无 M3U8</Tag>}</Space> },
          { title: "操作", width: 210, render: (_, row) => <Space><Button size="small" type="link" loading={detailLoading} onClick={() => void showDetail(row.id)}>详情</Button><Button size="small" type="link" icon={<CaretRightOutlined />} disabled={!row.playable} onClick={() => void showDetail(row.id, true)}>播放</Button><Button size="small" type="link" disabled={row.imported || !row.playable} loading={importing} onClick={() => void importIds([row.id])}>加入视频库</Button></Space> },
        ]}
      />
      <Modal open={!!detail} title="采集视频详情" width={860} footer={<Space><Button type="primary" icon={<CaretRightOutlined />} onClick={() => setPlaying(value => !value)}>{playing ? "停止播放" : "播放"}</Button><Button onClick={() => { setDetail(undefined); setPlaying(false); }}>关闭</Button></Space>} onCancel={() => { setDetail(undefined); setPlaying(false); }} destroyOnHidden>
        {detail && <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {playing && <CollectedPlayer url={detail.playbackUrl} trimStart={detail.trimStart} trimEnd={detail.trimEnd} seekTime={previewSeek} />}
          <Space align="start">
            <Image src={detail.thumbnail} width={150} height={200} style={{ objectFit: "cover", borderRadius: 6 }} referrerPolicy="no-referrer" />
            <Descriptions bordered size="small" column={1} style={{ flex: 1 }}>
              <Descriptions.Item label="资源站 ID">{detail.remoteId}</Descriptions.Item>
              <Descriptions.Item label="片源">{detail.sourceName}</Descriptions.Item>
              <Descriptions.Item label="状态"><Space>{<Tag color="green">已采集</Tag>}{detail.imported ? <Tag color="blue">已入视频库</Tag> : <Tag>未入视频库</Tag>}</Space></Descriptions.Item>
              <Descriptions.Item label="分类">{detail.category || "-"}</Descriptions.Item>
              <Descriptions.Item label="时长">{detail.duration ? `${detail.duration} 秒` : "未知"}</Descriptions.Item>
              <Descriptions.Item label="源站更新">{detail.updatedAt || "-"}</Descriptions.Item>
            </Descriptions>
          </Space>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="标题">{detail.title}</Descriptions.Item>
            <Descriptions.Item label="简介">{detail.description || "-"}</Descriptions.Item>
            <Descriptions.Item label="标签"><Space wrap>{detail.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</Space></Descriptions.Item>
            <Descriptions.Item label="M3U8"><Typography.Text copyable ellipsis style={{ maxWidth: 560 }}>{detail.playbackUrl}</Typography.Text></Descriptions.Item>
          </Descriptions>
          <Card size="small" title="预览截图" extra={<Space><span>{previews.status==="processing"?`生成中（${previews.items.length} 张）`:previews.status==="failed"?`失败：${previews.error||"未知错误"}`:`已生成 ${previews.items.length} 张`}</span><Button loading={previews.status==="processing"} onClick={()=>void generatePreviews(previews.items.length>0)}>{previews.items.length?"重新生成":"生成预览截图"}</Button></Space>}>
            {previews.items.length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>{previews.items.map(item=><div key={item.id}><button onClick={()=>{setPlaying(true);setPreviewSeek(item.time)}} style={{position:"relative",width:"100%",height:82,padding:0,border:0,borderRadius:6,overflow:"hidden",cursor:"pointer",background:"#111"}}><PreviewImage src={item.image}/><span style={{position:"absolute",right:4,bottom:4,color:"white",background:"rgba(0,0,0,.7)",padding:"1px 5px",borderRadius:3}}>{Math.floor(item.time/60)}:{String(Math.floor(item.time%60)).padStart(2,"0")}</span></button><Popconfirm title="删除后自动补充一张" onConfirm={()=>void deletePreview(item.id)}><Button danger type="link" size="small">删除并补充</Button></Popconfirm></div>)}</div>:<Typography.Text type="secondary">尚未生成。无需加入视频库即可生成并点击跳转。</Typography.Text>}
          </Card>
        </Space>}
      </Modal>
    </Card>
  );
}
