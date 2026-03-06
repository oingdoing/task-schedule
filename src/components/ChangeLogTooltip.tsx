import { useState } from 'react';
import type { ChangeNote } from '../types/schedule';

interface ChangeLogTooltipProps {
  notes?: ChangeNote[];
  onUndoChange?: (logId: string) => void;
}

export default function ChangeLogTooltip({ notes, onUndoChange }: ChangeLogTooltipProps) {
  const [open, setOpen] = useState(false);

  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <span className={`change-log-wrap ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="change-dot"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label="변경 이력 보기"
      >
        ●
      </button>
      <span className="change-tooltip" role="tooltip">
        <ul className="change-tooltip-list">
          {notes.map((note) => (
            <li key={note.logId} className="change-tooltip-item">
              <span>{note.message}</span>
              {onUndoChange && (
                <button
                  type="button"
                  className="secondary change-undo-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onUndoChange(note.logId);
                  }}
                >
                  변경 취소
                </button>
              )}
            </li>
          ))}
        </ul>
      </span>
    </span>
  );
}
