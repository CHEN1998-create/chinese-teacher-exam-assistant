"use client";

import { useRef, useState } from "react";
import { AnnouncementSourceInput, ExamTarget } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { SAMPLE_ANNOUNCEMENT_TEXT } from "@/lib/mock-data";

type SourceType = AnnouncementSourceInput["sourceType"];

const SOURCE_TABS: { value: SourceType; label: string; icon: string; hint: string }[] = [
  { value: "announcement_url", label: "公告链接", icon: "🔗", hint: "粘贴教育局/人社局官网公告链接" },
  { value: "announcement_text", label: "文本粘贴", icon: "📝", hint: "直接粘贴公告正文，本地识别字段" },
  { value: "announcement_file", label: "文件上传", icon: "📎", hint: "演示环境不接收文件（占位入口）" },
];

interface AnnouncementSubmitFormProps {
  target: ExamTarget;
  busy: boolean;
  onSubmit: (input: AnnouncementSourceInput) => Promise<void> | void;
}

/** 公告提交入口：链接 / 文本粘贴 / 文件上传占位 */
export function AnnouncementSubmitForm({ target, busy, onSubmit }: AnnouncementSubmitFormProps) {
  const [sourceType, setSourceType] = useState<SourceType>("announcement_url");
  const [url, setUrl] = useState(target.announcementUrl ?? "");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileUnsupported = sourceType === "announcement_file" && !!fileName;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setFileSize(file.size);
    } else {
      setFileName("");
      setFileSize(0);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      if (sourceType === "announcement_url") {
        await onSubmit({ sourceType, url });
      } else if (sourceType === "announcement_text") {
        await onSubmit({ sourceType, text });
      } else {
        await onSubmit({ sourceType, fileName, fileSize });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，请重试");
    }
  };

  return (
    <Card>
      <CardHeader
        title="提交公告或来源信息"
        description="提交后自动生成结构化考试画像。AI 提取结果只会标记为“AI已提取/待审核”，官方确认需人工审核"
      />

      {/* 来源类型切换 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setSourceType(tab.value);
              setError(null);
            }}
            className={`p-2.5 rounded-xl border-2 text-center transition-all ${
              sourceType === tab.value
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="block text-lg">{tab.icon}</span>
            <span className="block text-xs font-medium text-slate-900 mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          ⚠️ {error}
        </div>
      )}

      {sourceType === "announcement_url" && (
        <div className="space-y-3">
          <Input
            label="公告链接"
            placeholder="https://www.example.gov.cn/...（以 http(s):// 开头）"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            hint="演示环境不会真实访问网页，将按目标信息模拟提取，结果中会明确标注"
          />
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "提交中..." : "提交并开始提取"}
          </Button>
        </div>
      )}

      {sourceType === "announcement_text" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">公告正文</span>
            <button
              type="button"
              onClick={() => setText(SAMPLE_ANNOUNCEMENT_TEXT)}
              className="text-xs text-blue-600 hover:underline"
            >
              填入示例公告
            </button>
          </div>
          <Textarea
            className="min-h-[180px]"
            placeholder="将公告全文粘贴到这里，系统会在本地识别报名时间、考试时间、科目、分值、资格条件、考试范围等字段"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            已输入 {text.trim().length} 字 · 内容少于 10 字会提取失败（可用于演示失败与重试）
          </p>
          <Button onClick={handleSubmit} disabled={busy || text.trim().length === 0}>
            {busy ? "提交中..." : "提交并开始提取"}
          </Button>
        </div>
      )}

      {sourceType === "announcement_file" && (
        <div className="space-y-3">
          <label
            htmlFor="announcement-file"
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl px-6 py-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          >
            <span className="text-2xl">📎</span>
            <span className="text-sm text-slate-600">
              {fileName || "点击选择公告文件（PDF / PNG / JPG / DOC / DOCX）"}
            </span>
            {fileSize > 0 && (
              <span className="text-xs text-slate-400">{(fileSize / 1024).toFixed(1)} KB</span>
            )}
            <input
              id="announcement-file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-5">
            公开演示环境不接收任何真实文件：这里只会记录文件名，不会读取、解析、保存或上传文件。
            请改用“公告链接”或“文本粘贴”完成提取。
          </p>
          <Button onClick={handleSubmit} disabled={busy || fileUnsupported} title={fileUnsupported ? "文件解析尚未开放" : undefined}>
            提交并开始提取
          </Button>
        </div>
      )}
    </Card>
  );
}
