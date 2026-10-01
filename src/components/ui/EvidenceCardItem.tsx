import { EvidenceCard } from "@/types";
import { EvidenceBadge } from "./Badge";
import { Card } from "./Card";
import { formatDate } from "@/lib/utils";

interface EvidenceCardItemProps {
  card: EvidenceCard;
  showSource?: boolean;
}

export function EvidenceCardItem({ card, showSource = true }: EvidenceCardItemProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-medium text-slate-900">{card.title}</h4>
        <EvidenceBadge level={card.level} />
      </div>
      <p className="text-sm text-slate-600 whitespace-pre-line mb-3">
        {card.content}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        {showSource && (
          <span>
            来源：{card.source}
            {card.sourceUrl && (
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-600 hover:underline"
              >
                查看
              </a>
            )}
          </span>
        )}
        <span>更新：{formatDate(card.lastVerifiedAt)}</span>
      </div>
      {card.notes && (
        <p className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          {card.notes}
        </p>
      )}
    </Card>
  );
}
