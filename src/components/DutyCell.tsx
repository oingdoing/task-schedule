import type { ChangeNote, DutyType } from '../types/schedule';
import ChangeLogTooltip from './ChangeLogTooltip';
import SearchHighlight from './SearchHighlight';

interface DutyCellProps {
  value: string;
  dutyType: DutyType;
  swappable: boolean;
  selected: boolean;
  highlighted: boolean;
  emphasized?: boolean;
  searchQuery?: string;
  rowSpan?: number;
  onClick: () => void;
  notes?: ChangeNote[];
  onUndoChange: (logId: string) => void;
}

export default function DutyCell({
  value,
  dutyType,
  swappable,
  selected,
  highlighted,
  emphasized = false,
  searchQuery = '',
  rowSpan,
  onClick,
  notes,
  onUndoChange,
}: DutyCellProps) {
  const isEmptyValue = !value || value === '-' || value.startsWith('당번 없음');
  const tdClassName = [
    'duty-td',
    highlighted ? 'highlight' : '',
    isEmptyValue ? 'empty-cell' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td rowSpan={rowSpan} className={tdClassName}>
      <div className="duty-cell">
        {swappable ? (
          <button
            type="button"
            className={`duty-btn ${selected ? 'selected' : ''} ${emphasized ? 'changed-person' : ''}`}
            onClick={onClick}
            aria-label={`${dutyType} 담당자 ${value}`}
          >
            {isEmptyValue ? (
              ''
            ) : (
              <SearchHighlight text={value} query={searchQuery} />
            )}
          </button>
        ) : (
          <span className={`duty-text ${emphasized ? 'changed-person' : ''}`}>
            {isEmptyValue ? '' : <SearchHighlight text={value} query={searchQuery} />}
          </span>
        )}
        <ChangeLogTooltip notes={notes} onUndoChange={onUndoChange} />
      </div>
    </td>
  );
}
