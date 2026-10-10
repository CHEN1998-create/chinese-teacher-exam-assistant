export function DatasetScopeNotice({ hasDemo }: { hasDemo: boolean }) {
  if (!hasDemo) return null;

  return (
    <aside className="rounded-xl border border-warn/25 bg-warn-soft/60 px-4 py-3" aria-label="数据范围说明">
      <p className="text-sm font-semibold text-ink">虚构试用机会与真实监测范围分开显示</p>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        页面中的试用岗位是虚构示例，不可用于真实报名；杭州、宁波的监测范围只说明已核对的真实官方渠道。
      </p>
    </aside>
  );
}
