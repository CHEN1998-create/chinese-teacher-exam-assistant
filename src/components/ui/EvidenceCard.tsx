import { cn } from "@/lib/utils";

/**
 * 证据卡片（v7 原型 .ev / .src）
 *
 * 三层结构中的"证据和可信度"层：
 * - rows：结构化键值表（学历/专业/年龄/资格证/招录人数等）
 * - source：公告原文块，serif 字体 + 左边框 brand，含原文片段与可信度标记
 *
 * 不擅自删除公告证据、来源或不确定性提示。
 */
export interface EvidenceRow {
  label: string;
  value: string;
}

export interface EvidenceSource {
  title: string;
  url?: string;
  snippet?: string;
  updatedAt?: string;
  /** 数据是否经过人工确认；false 时组件会显示"未经人工确认"提示 */
  confirmed?: boolean;
}

interface EvidenceCardProps {
  rows?: EvidenceRow[];
  source?: EvidenceSource;
  className?: string;
}

export function EvidenceCard({ rows, source, className }: EvidenceCardProps) {
  return (
    <section
      aria-label="判断依据与公告证据"
      className={cn("grid gap-2.5", className)}
    >
      {rows && rows.length > 0 && (
        <dl className="grid gap-2.5">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3.5 gap-y-1 text-sm"
            >
              <dt className="text-ink-muted">{r.label}</dt>
              <dd className="text-ink break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {source && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span className="font-semibold text-ink-2">公告来源</span>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-brand-strong underline underline-offset-2 hover:text-brand break-all"
              >
                {source.title}
              </a>
            ) : (
              <span className="text-ink">{source.title}</span>
            )}
            {source.updatedAt && <span>· 更新 {source.updatedAt}</span>}
            {source.confirmed === false && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-warn-soft text-warn">
                未经人工确认
              </span>
            )}
          </div>
          {source.snippet && (
            <blockquote
              className="bg-surface-2 border-l-[3px] border-brand rounded-r-sm px-3.5 py-2.5 text-sm text-ink"
              style={{ fontFamily: "var(--font-serif, ui-serif, Georgia, serif)" }}
            >
              <p className="whitespace-pre-line leading-relaxed">{source.snippet}</p>
            </blockquote>
          )}
        </div>
      )}
    </section>
  );
}
