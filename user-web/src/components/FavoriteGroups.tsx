import { useState } from "react";
import { library, type FavoriteGroup } from "@/services/library";

export default function FavoriteGroups({ groups, active, onChange }: { groups: FavoriteGroup[]; active: string; onChange: (id: string) => void }) {
  const [name, setName] = useState(""), [error, setError] = useState("");
  const current = groups.find(group => group.id === active);
  const save = (id?: string) => {
    try { const group = library.saveGroup(name, id); setName(""); setError(""); onChange(group.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
  };
  return <div className="space-y-2">
    <select aria-label="收藏分组" value={active} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-background-300 bg-background-50 p-2.5 text-sm">
      <option value="all">全部收藏</option><option value="ungrouped">未分组</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
    </select>
    <details className="rounded-lg border border-background-200 p-3">
      <summary className="cursor-pointer text-sm">管理收藏分组</summary>
      <label className="mt-3 block text-xs text-foreground-500">分组名称<input aria-label="分组名称" value={name} maxLength={20} onChange={event => setName(event.target.value)} placeholder="例如：稍后观看" className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2 text-sm text-foreground-800" /></label>
      <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => save()} className="rounded-full bg-primary-500 px-3 py-2 text-xs text-white">创建分组</button>
        {current && <><button onClick={() => save(current.id)} className="rounded-full bg-background-100 px-3 py-2 text-xs">重命名当前分组</button><button onClick={() => {
          if (!window.confirm(`删除“${current.name}”分组？收藏视频会保留并移入未分组。`)) return;
          library.deleteGroup(current.id); onChange("ungrouped"); setError("");
        }} className="rounded-full bg-background-100 px-3 py-2 text-xs">删除当前分组</button></>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
    </details>
  </div>;
}
