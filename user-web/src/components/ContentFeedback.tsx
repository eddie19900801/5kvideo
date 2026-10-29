import { useRef, useState } from "react";
import { analytics } from "@/services/analytics";

export default function ContentFeedback({ videoId, title }: { videoId: string; title: string }) {
  const [reason, setReason] = useState("无法播放"), [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const sending = useRef(false);
  return <details className="mt-4 rounded-xl border border-background-200 p-3">
    <summary className="cursor-pointer text-sm text-foreground-600">反馈视频问题</summary>
    {status === "sent" ? <p role="status" className="mt-3 text-sm text-primary-600">反馈已收到，感谢帮助我们改进。</p> :
      <form className="mt-3 space-y-3" onSubmit={async event => {
        event.preventDefault();
        if (sending.current) return;
        sending.current = true; setStatus("sending");
        try {
          const accepted = await analytics.report("content_feedback", { videoId, metadata: { reason, note: note.trim(), title: title.slice(0, 200) } });
          setStatus(accepted ? "sent" : "error");
        } catch { setStatus("error"); }
        finally { sending.current = false; }
      }}>
        <label className="block text-sm">问题类型
          <select aria-label="问题类型" value={reason} onChange={event => setReason(event.target.value)} disabled={status === "sending"} className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2">
            {["无法播放", "封面或标题不符", "重复内容", "分类错误", "内容投诉", "其他问题"].map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="block text-sm">补充说明（选填）
          <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={200} disabled={status === "sending"} rows={3} placeholder="请描述遇到的问题，请勿填写密码等敏感信息" className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2" />
        </label>
        {status === "error" && <p role="alert" className="text-sm text-red-500">提交失败，内容已保留，请重试。</p>}
        <button disabled={status === "sending"} className="rounded-full bg-primary-500 px-4 py-2 text-sm text-white disabled:opacity-50">{status === "sending" ? "正在提交…" : "提交反馈"}</button>
      </form>}
  </details>;
}
