import type { AssignmentRow, DutyType } from '../types/schedule';
import { parseTeamWithMembers } from '../utils/rotation';

interface WeekDetailPanelProps {
  isOpen: boolean;
  weekLabel: string | null;
  rows: AssignmentRow[];
  onClose: () => void;
}

function getDayOfWeek(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function isVisibleDutyValue(value: string): boolean {
  return !!value && value !== '-' && !value.startsWith('당번 없음');
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function firstNonEmpty(rows: AssignmentRow[], duty: DutyType): string {
  const found = rows.map((row) => row.assignments[duty]).find(isVisibleDutyValue);
  return found ?? '';
}

function buildPartialDutyLine(rows: AssignmentRow[], duty: DutyType, label: string): string {
  const entries = rows
    .filter((row) => row.slot.hasDuty)
    .map((row) => ({
      date: row.slot.date,
      value: row.assignments[duty],
    }));

  if (entries.length === 0) {
    return '';
  }

  const hasVisibleValue = entries.some((entry) => isVisibleDutyValue(entry.value));
  if (!hasVisibleValue) {
    return '';
  }

  const visibleValues = entries.filter((entry) => isVisibleDutyValue(entry.value));
  const uniqueVisibleValues = [...new Set(visibleValues.map((entry) => entry.value))];
  const hasHiddenGap = entries.some((entry) => !isVisibleDutyValue(entry.value));

  if (!hasHiddenGap && uniqueVisibleValues.length === 1) {
    return `${label}:${uniqueVisibleValues[0]}`;
  }

  const formatted = entries
    .map((entry) =>
      `${formatShortDate(entry.date)} ${isVisibleDutyValue(entry.value) ? entry.value : '없음'}`,
    )
    .join(' / ');
  return `${label}: ${formatted}`;
}

function buildWeekSummaryLines(rows: AssignmentRow[]): string[] {
  if (rows.length === 0) {
    return [];
  }

  const dishTeamForDay = (targetDay: number): string => {
    const row = rows.find((weekRow) => getDayOfWeek(weekRow.slot.date) === targetDay);
    if (!row) {
      return '';
    }
    const value = row.assignments.설거지;
    const parsed = parseTeamWithMembers(value);
    return parsed ? parsed.teamName : value;
  };

  const satTeam = dishTeamForDay(6);
  const sunTeam = dishTeamForDay(0);
  const dishParts: string[] = [];
  if (satTeam) {
    dishParts.push(`(토)${satTeam}`);
  }
  if (sunTeam) {
    dishParts.push(`(일)${sunTeam}`);
  }
  const dishLine = dishParts.length > 0 ? `설거지: ${dishParts.join(' ')}` : '';

  const mainPi = firstNonEmpty(rows, '피청');
  const mainKeo = firstNonEmpty(rows, '커청');
  const mainLineParts: string[] = [];
  if (mainPi) {
    mainLineParts.push(`피청:${mainPi}`);
  }
  if (mainKeo) {
    mainLineParts.push(`커청:${mainKeo}`);
  }
  const mainLine = mainLineParts.join(' / ');

  const geonLine = buildPartialDutyLine(rows, '건청', '건청');
  const snack = firstNonEmpty(rows, '간식');
  const pairLineParts: string[] = [];
  if (geonLine) {
    pairLineParts.push(geonLine);
  }
  if (snack) {
    pairLineParts.push(`간식:${snack}`);
  }
  const pairLine = pairLineParts.join(' / ');

  const weekdayLeader =
    rows
      .filter((row) => getDayOfWeek(row.slot.date) === 3)
      .map((row) => row.assignments.본교팀장)
      .find((value) => !!value && value !== '-' && !value.startsWith('당번 없음')) ?? '';

  const weekendLeader =
    rows
      .filter((row) => {
        const day = getDayOfWeek(row.slot.date);
        return day === 0 || day === 6;
      })
      .map((row) => row.assignments.본교팀장)
      .find((value) => !!value && value !== '-' && !value.startsWith('당번 없음')) ?? '';

  const leaderParts: string[] = [];
  if (weekdayLeader) {
    leaderParts.push(`주중 ${weekdayLeader}`);
  }
  if (weekendLeader) {
    if (!leaderParts.includes(`주중 ${weekendLeader}`)) {
      leaderParts.push(`주말 ${weekendLeader}`);
    }
  }
  const leaderLine = leaderParts.length > 0 ? `본교팀장: ${leaderParts.join(', ')}` : '';

  const lines: string[] = ['[이번주 당번]'];
  if (dishLine) {
    lines.push(dishLine);
  }
  if (mainLine) {
    lines.push(mainLine);
  }
  if (pairLine) {
    lines.push(pairLine);
  }
  if (leaderLine) {
    lines.push(leaderLine);
  }

  return lines;
}

export default function WeekDetailPanel({ isOpen, weekLabel, rows, onClose }: WeekDetailPanelProps) {
  if (!isOpen) {
    return null;
  }

  const summaryLines = buildWeekSummaryLines(rows);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card week-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h3>주 단위 담당 보기 {weekLabel ? `(${weekLabel})` : ''}</h3>
        </header>

        <div className="modal-body week-panel">
          {summaryLines.length === 0 ? (
            <p>선택한 주차에 표시할 데이터가 없습니다.</p>
          ) : (
            <div className="week-summary">
              {summaryLines.map((line, index) => (
                <div key={`${index}-${line}`}>{line}</div>
              ))}
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
