import type { AssignmentRow, ChangeNote, DutyType, SwapDutyType } from '../types/schedule';
import {
  DUTY_COLUMNS,
  SWAPPABLE_DUTIES,
  getDutyLabel,
  getMonthLastDate,
  getWeekLastDate,
  parseTeamWithMembers,
  toISODate,
} from '../utils/rotation';
import type { SwapTarget } from '../hooks/useSwapMode';
import ChangeLogTooltip from './ChangeLogTooltip';
import DateCell from './DateCell';
import DutyCell from './DutyCell';
import SearchHighlight from './SearchHighlight';

interface ScheduleTableProps {
  rows: AssignmentRow[];
  swapSource: SwapTarget | null;
  searchQuery?: string;
  onOpenWeekDetail: (weekKey: string) => void;
  onDutyClick: (row: AssignmentRow, duty: SwapDutyType, person?: string) => void;
  onUndoChange: (logId: string) => void;
}

interface MonthMeta {
  rowSpan: number;
  restroomValue: string;
  restroomSourceRow: AssignmentRow | null;
}

interface DutyMergeMeta {
  startRowSpan: Map<number, number>;
  hiddenRows: Set<number>;
}

const MERGEABLE_DUTIES: DutyType[] = ['피청', '커청', '건청', '간식', '본교팀장'];

/** 주간 단위 담당: 빈 행 건너뛰고 병합 (피청·커청·건청·간식) */
const MERGE_ACROSS_EMPTY_DUTIES: DutyType[] = ['피청', '커청', '건청', '간식'];

function isMergeCandidate(row: AssignmentRow, duty: DutyType): boolean {
  if (!row.slot.hasDuty) {
    return false;
  }
  const value = row.assignments[duty];
  return Boolean(value) && value !== '-' && !value.startsWith('당번 없음');
}

function isEmptyDutyValue(value: string): boolean {
  return !value || value === '-' || value.startsWith('당번 없음');
}

/** 병합된 셀: 스팬 전체의 changeNotes를 모아서 dot이 숨겨진 행의 로그도 표시 */
function getMergedNotes(
  rows: AssignmentRow[],
  startIndex: number,
  span: number | undefined,
  duty: DutyType,
): ChangeNote[] | undefined {
  if (!span || span < 2) {
    return rows[startIndex]?.changeNotes[duty];
  }
  const seen = new Set<string>();
  const result: ChangeNote[] = [];
  for (let i = 0; i < span; i++) {
    const row = rows[startIndex + i];
    for (const note of row?.changeNotes[duty] ?? []) {
      if (!seen.has(note.logId)) {
        seen.add(note.logId);
        result.push(note);
      }
    }
  }
  return result.length ? result : undefined;
}

function buildDutyMergeMeta(rows: AssignmentRow[], duty: DutyType): DutyMergeMeta {
  const startRowSpan = new Map<number, number>();
  const hiddenRows = new Set<number>();
  const mergeAcrossEmpty = MERGE_ACROSS_EMPTY_DUTIES.includes(duty);

  for (let index = 0; index < rows.length; ) {
    const currentRow = rows[index];
    if (!isMergeCandidate(currentRow, duty)) {
      index += 1;
      continue;
    }

    const currentValue = currentRow.assignments[duty];
    let end = index + 1;
    while (end < rows.length) {
      const nextRow = rows[end];
      const nextValue = nextRow.assignments[duty];

      if (mergeAcrossEmpty && isEmptyDutyValue(nextValue)) {
        end += 1;
      } else if (!isMergeCandidate(nextRow, duty) || nextValue !== currentValue) {
        break;
      } else {
        end += 1;
      }
    }

    const span = end - index;
    if (span >= 2) {
      startRowSpan.set(index, span);
      for (let hiddenIndex = index + 1; hiddenIndex < end; hiddenIndex += 1) {
        hiddenRows.add(hiddenIndex);
      }
    }

    index = end;
  }

  return { startRowSpan, hiddenRows };
}

function isSwappable(duty: DutyType, row: AssignmentRow): duty is SwapDutyType {
  if (!row.slot.hasDuty) {
    return false;
  }
  if (!SWAPPABLE_DUTIES.includes(duty as SwapDutyType)) {
    return false;
  }
  const value = row.assignments[duty];
  return (
    Boolean(value) &&
    value !== '-' &&
    value !== '경배일' &&
    !value.startsWith('당번 없음')
  );
}

function getRestroomSourceRow(monthRows: AssignmentRow[]): AssignmentRow | null {
  const candidate = monthRows.find(
    (row) =>
      row.slot.hasDuty &&
      row.assignments.화장실청소 !== '-' &&
      !row.assignments.화장실청소.startsWith('당번 없음'),
  );

  return candidate ?? null;
}

function parseCommaMembers(value: string): string[] {
  if (!value || value === '-' || value.startsWith('당번 없음')) {
    return [];
  }

  return value
    .split(',')
    .map((member) => member.trim())
    .filter(Boolean);
}

function renderTeamMemberCell(
  key: string,
  duty: '설거지' | '화장실청소',
  value: string,
  sourceRow: AssignmentRow | null,
  swapSource: SwapTarget | null,
  highlighted: boolean,
  rowSpan: number | undefined,
  onDutyClick: (row: AssignmentRow, duty: SwapDutyType, person?: string) => void,
  onUndoChange: (logId: string) => void,
  notes?: ChangeNote[],
  changedPeople?: string[],
  searchQuery?: string,
  additionalTdClass?: string,
) {
  const parsed = parseTeamWithMembers(value);
  const swappable = sourceRow ? isSwappable(duty, sourceRow) : false;
  const changedSet = new Set(changedPeople ?? []);
  const isEmptyValue = !value || value === '-' || value.startsWith('당번 없음');
  const tdClassName = [
    'duty-td',
    highlighted ? 'highlight' : '',
    isEmptyValue ? 'empty-cell' : '',
    duty === '화장실청소' ? 'duty-td-restroom' : '',
    additionalTdClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!parsed) {
    const emphasized = changedSet.has(value);
    return (
      <td key={key} rowSpan={rowSpan} className={tdClassName}>
        <div className="duty-cell">
          <span className={`duty-text ${emphasized ? 'changed-person' : ''}`}>
            {isEmptyValue ? '' : <SearchHighlight text={value} query={searchQuery ?? ''} />}
          </span>
          <ChangeLogTooltip notes={notes} onUndoChange={onUndoChange} />
        </div>
      </td>
    );
  }

  const restroomExtra =
    duty === '화장실청소' && parsed
      ? (() => {
          const match = parsed.teamName.match(/^(\d+)/);
          const num = match ? Number.parseInt(match[1], 10) : 0;
          return num % 2 === 1 ? '제빙기' : '화장실';
        })()
      : null;

  return (
    <td key={key} rowSpan={rowSpan} className={`duty-td ${highlighted ? 'highlight' : ''} ${duty === '화장실청소' ? 'duty-td-restroom' : ''} ${additionalTdClass ?? ''}`}>
      <div className="duty-cell duty-cell-team">
        {restroomExtra && (
          <span className="restroom-extra-badge" aria-hidden>
            {restroomExtra}
          </span>
        )}
        <span className="team-badge">
          <SearchHighlight text={parsed.teamName} query={searchQuery ?? ''} />
        </span>
        <div className="team-member-list">
          {parsed.members.map((member) => {
            const memberSelected =
              !!swapSource &&
              !!sourceRow &&
              swapSource.slotId === sourceRow.slot.id &&
              swapSource.dutyType === duty &&
              swapSource.person === member;

            return swappable && sourceRow ? (
              <button
                key={`${sourceRow.slot.id}-${duty}-${member}`}
                type="button"
                className={`duty-btn dish-member-btn ${memberSelected ? 'selected' : ''} ${changedSet.has(member) ? 'changed-person' : ''}`}
                onClick={() => onDutyClick(sourceRow, duty, member)}
                aria-label={`${duty} 담당자 ${member}`}
              >
                <SearchHighlight text={member} query={searchQuery ?? ''} />
              </button>
            ) : (
              <span
                key={`${duty}-${member}`}
                className={`dish-member-text ${changedSet.has(member) ? 'changed-person' : ''}`}
              >
                <SearchHighlight text={member} query={searchQuery ?? ''} />
              </span>
            );
          })}
        </div>
        <ChangeLogTooltip notes={notes} onUndoChange={onUndoChange} />
      </div>
    </td>
  );
}

function renderCommaMemberCell(
  key: string,
  duty: '건청',
  value: string,
  row: AssignmentRow,
  swapSource: SwapTarget | null,
  highlighted: boolean,
  rowSpan: number | undefined,
  onDutyClick: (row: AssignmentRow, duty: SwapDutyType, person?: string) => void,
  onUndoChange: (logId: string) => void,
  notes?: ChangeNote[],
  changedPeople?: string[],
  searchQuery?: string,
  additionalTdClass?: string,
) {
  const members = parseCommaMembers(value);
  const swappable = isSwappable(duty, row);
  const changedSet = new Set(changedPeople ?? []);

  if (members.length === 0) {
    const emphasized = changedSet.has(value);
    return (
      <td
        key={key}
        rowSpan={rowSpan}
        className={`duty-td ${highlighted ? 'highlight' : ''} ${
          !value || value === '-' || value.startsWith('당번 없음') ? 'empty-cell' : ''
        }`}
      >
        <div className="duty-cell">
          <span className={`duty-text ${emphasized ? 'changed-person' : ''}`}>
            {!value || value === '-' || value.startsWith('당번 없음') ? (
              ''
            ) : (
              <SearchHighlight text={value} query={searchQuery ?? ''} />
            )}
          </span>
          <ChangeLogTooltip notes={notes} onUndoChange={onUndoChange} />
        </div>
      </td>
    );
  }

  return (
    <td key={key} rowSpan={rowSpan} className={`duty-td ${highlighted ? 'highlight' : ''}`}>
      <div className="duty-cell duty-cell-team">
        <div className="team-member-list">
          {members.map((member) => {
            const memberSelected =
              !!swapSource &&
              swapSource.slotId === row.slot.id &&
              swapSource.dutyType === duty &&
              swapSource.person === member;

            return swappable ? (
              <button
                key={`${row.slot.id}-${duty}-${member}`}
                type="button"
                className={`duty-btn dish-member-btn ${memberSelected ? 'selected' : ''} ${changedSet.has(member) ? 'changed-person' : ''}`}
                onClick={() => onDutyClick(row, duty, member)}
                aria-label={`${duty} 담당자 ${member}`}
              >
                <SearchHighlight text={member} query={searchQuery ?? ''} />
              </button>
            ) : (
              <span
                key={`${duty}-${member}`}
                className={`dish-member-text ${changedSet.has(member) ? 'changed-person' : ''}`}
              >
                <SearchHighlight text={member} query={searchQuery ?? ''} />
              </span>
            );
          })}
        </div>
        <ChangeLogTooltip notes={notes} onUndoChange={onUndoChange} />
      </div>
    </td>
  );
}

export default function ScheduleTable({
  rows,
  swapSource,
  searchQuery = '',
  onOpenWeekDetail,
  onDutyClick,
  onUndoChange,
}: ScheduleTableProps) {
  const monthMetaByStart = new Map<number, MonthMeta>();
  const dutyMergeMetaByDuty = new Map<DutyType, DutyMergeMeta>();
  const weekRowSpanByStart = new Map<number, number>();

  for (let index = 0; index < rows.length; ) {
    const currentMonth = rows[index].monthKey;
    let end = index + 1;
    while (end < rows.length && rows[end].monthKey === currentMonth) {
      end += 1;
    }

    const monthRows = rows.slice(index, end);
    const restroomSourceRow = getRestroomSourceRow(monthRows);
    const restroomValue = restroomSourceRow
      ? restroomSourceRow.assignments.화장실청소
      : monthRows[0]?.assignments.화장실청소 ?? '-';

    monthMetaByStart.set(index, {
      rowSpan: end - index,
      restroomValue,
      restroomSourceRow,
    });

    index = end;
  }

  // 주 단위 rowSpan 계산
  for (let index = 0; index < rows.length; ) {
    const currentWeek = rows[index].weekKey;
    let end = index + 1;
    while (end < rows.length && rows[end].weekKey === currentWeek) {
      end += 1;
    }

    weekRowSpanByStart.set(index, end - index);

    index = end;
  }

  MERGEABLE_DUTIES.forEach((duty) => {
    dutyMergeMetaByDuty.set(duty, buildDutyMergeMeta(rows, duty));
  });

  return (
    <div className="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>월</th>
            <th>날짜</th>
            <th>{getDutyLabel('설거지')}</th>
            <th>{getDutyLabel('피청')}</th>
            <th>{getDutyLabel('커청')}</th>
            <th>{getDutyLabel('건청')}</th>
            <th>{getDutyLabel('간식')}</th>
            <th>{getDutyLabel('본교팀장')}</th>
            <th>{getDutyLabel('화장실청소')}</th>
            <th>주 담당</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const monthMeta = monthMetaByStart.get(index);
            const isWeekBoundary = index > 0 && rows[index - 1].weekKey !== row.weekKey;
            const isMonthFirstRow =
              index === 0 || rows[index - 1].monthKey !== row.monthKey;
            const weekRowSpan = weekRowSpanByStart.get(index);
            const weekLastDate = getWeekLastDate(row.slot.date);
            const todayStr = toISODate(new Date());
            const isWeekPassed = weekLastDate < todayStr;

            return (
              <tr
                key={row.slot.id}
                className={`${!row.slot.hasDuty ? 'no-duty-row' : ''} ${isWeekBoundary ? 'week-boundary-row' : ''} ${isMonthFirstRow ? 'month-first-row' : ''} ${isWeekPassed ? 'week-passed' : ''}`}
              >
                {monthMeta ? (
                  <td rowSpan={monthMeta.rowSpan} className="month-cell">
                    {row.monthLabel}
                  </td>
                ) : null}
                <DateCell slot={row.slot} />
                {DUTY_COLUMNS.map((duty) => {
                  if (duty === '화장실청소') {
                    if (!monthMeta) {
                      return null;
                    }

                    const sourceRow = monthMeta.restroomSourceRow;
                    const highlighted =
                      !!swapSource &&
                      !!sourceRow &&
                      swapSource.dutyType === duty &&
                      swapSource.slotId !== sourceRow.slot.id;
                    const monthLastDate = getMonthLastDate(row.monthKey);
                    const isMonthPassed = monthLastDate < todayStr;

                    return renderTeamMemberCell(
                      `${row.slot.id}-${duty}`,
                      duty,
                      monthMeta.restroomValue,
                      sourceRow,
                      swapSource,
                      highlighted,
                      monthMeta.rowSpan,
                      onDutyClick,
                      onUndoChange,
                      sourceRow?.changeNotes[duty],
                      sourceRow?.changedPeople[duty],
                      searchQuery,
                      isMonthPassed ? 'month-passed' : undefined,
                    );
                  }

                  if (duty === '설거지') {
                    const highlighted =
                      !!swapSource &&
                      swapSource.dutyType === duty &&
                      swapSource.slotId !== row.slot.id;

                    return renderTeamMemberCell(
                      `${row.slot.id}-${duty}`,
                      duty,
                      row.assignments.설거지,
                      row,
                      swapSource,
                      highlighted,
                      undefined,
                      onDutyClick,
                      onUndoChange,
                      row.changeNotes[duty],
                      row.changedPeople[duty],
                      searchQuery,
                    );
                  }

                  const mergeMeta = dutyMergeMetaByDuty.get(duty);
                  if (mergeMeta?.hiddenRows.has(index)) {
                    return null;
                  }

                  const rowSpan = mergeMeta?.startRowSpan.get(index);

                  if (duty === '건청') {
                    const highlighted =
                      !!swapSource && swapSource.dutyType === duty && swapSource.slotId !== row.slot.id;

                    return renderCommaMemberCell(
                      `${row.slot.id}-${duty}`,
                      duty,
                      row.assignments[duty],
                      row,
                      swapSource,
                      highlighted,
                      rowSpan,
                      onDutyClick,
                      onUndoChange,
                      getMergedNotes(rows, index, rowSpan, duty) ?? row.changeNotes[duty],
                      row.changedPeople[duty],
                      searchQuery,
                    );
                  }

                  const swappable = isSwappable(duty, row);
                  const selected =
                    !!swapSource && swapSource.slotId === row.slot.id && swapSource.dutyType === duty;
                  const highlighted =
                    !!swapSource && swapSource.dutyType === duty && swapSource.slotId !== row.slot.id;
                  const emphasized = (row.changedPeople[duty] ?? []).includes(row.assignments[duty]);

                  return (
                    <DutyCell
                      key={`${row.slot.id}-${duty}`}
                      dutyType={duty}
                      value={row.assignments[duty]}
                      swappable={swappable}
                      selected={selected}
                      highlighted={highlighted}
                      emphasized={emphasized}
                      searchQuery={searchQuery}
                      rowSpan={rowSpan}
                      onClick={() => {
                        if (swappable) {
                          onDutyClick(row, duty, row.assignments[duty]);
                        }
                      }}
                      notes={getMergedNotes(rows, index, rowSpan, duty) ?? row.changeNotes[duty]}
                      onUndoChange={onUndoChange}
                    />
                  );
                })}
                {weekRowSpan ? (
                  <td className="week-detail-col" rowSpan={weekRowSpan}>
                    <button
                      type="button"
                      className="secondary week-detail-btn"
                      onClick={() => onOpenWeekDetail(row.weekKey)}
                    >
                      보기
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
