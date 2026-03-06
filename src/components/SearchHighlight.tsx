import type { ReactNode } from 'react';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface SearchHighlightProps {
  text: string;
  query: string;
  className?: string;
}

/** 검색어가 포함된 텍스트에서 검색어를 굵게 표시 */
export default function SearchHighlight({ text, query, className }: SearchHighlightProps): ReactNode {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || !text) {
    return <span className={className}>{text}</span>;
  }

  const escaped = escapeRegex(trimmed);
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed ? (
          <strong key={i}>{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
