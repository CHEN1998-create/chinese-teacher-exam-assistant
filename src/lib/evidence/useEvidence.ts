"use client";

import { useSyncExternalStore } from "react";
import { Correction, ExamTarget, EvidenceItem, ExtractionJob } from "@/types";
import { evidenceService } from "./evidenceService";
import { ProfileRow, buildProfileRows, summarizeRows } from "./domain";

/**
 * 目标考情证据的响应式读取：
 * 提取进度、证据入库、纠错提交后自动刷新；切换目标时只读到对应目标的数据。
 */
export function useEvidence(target: ExamTarget | null): {
  items: EvidenceItem[];
  rows: ProfileRow[];
  counts: ReturnType<typeof summarizeRows> | null;
  latestJob: ExtractionJob | null;
  jobs: ExtractionJob[];
  corrections: Correction[];
} {
  const targetId = target?.id ?? null;

  useSyncExternalStore(
    evidenceService.subscribe,
    () => `${evidenceService.getVersion()}:${targetId ?? ""}`,
    () => ""
  );

  if (!target) {
    return { items: [], rows: [], counts: null, latestJob: null, jobs: [], corrections: [] };
  }

  const items = evidenceService.getItems(target.id);
  const rows = buildProfileRows(target, items);
  return {
    items,
    rows,
    counts: summarizeRows(rows),
    latestJob: evidenceService.getLatestJob(target.id),
    jobs: evidenceService.getJobs(target.id),
    corrections: evidenceService.getCorrections(target.id),
  };
}
