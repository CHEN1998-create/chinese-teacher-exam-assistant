import type { PrimaryNavId } from "@/lib/ia/nav";

/**
 * 用户端主导航内联 SVG 图标（模块 0A：不使用任何境外图标 CDN/图标字体）。
 * 描边跟随 currentColor，激活态只改颜色与字重，不引入装饰图形。
 */
export function NavIcon({ id, className }: { id: PrimaryNavId; className?: string }) {
  const common = {
    className,
    fill: "none" as const,
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    "aria-hidden": true,
  };
  switch (id) {
    case "opportunities":
      return (
        <svg {...common} strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" strokeLinejoin="round" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...common} strokeWidth={1.8}>
          <rect x="3" y="4.5" width="18" height="17" rx="2" />
          <path d="M16 2.5v4M8 2.5v4M3 10h18" strokeLinecap="round" />
        </svg>
      );
    case "study":
      return (
        <svg {...common} strokeWidth={1.8}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
          <path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}
