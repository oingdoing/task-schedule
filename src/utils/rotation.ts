import type {
  AssignmentRow,
  ChangeNote,
  ChangeLogEntry,
  DutyAssignments,
  DutyType,
  ScheduleData,
  ScheduleMemoType,
  ScheduleSlot,
  SlotDutyEnabled,
  SlotSelectableDuty,
  SwapDutyType,
} from '../types/schedule';

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DATE_CELL_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});
const DATE_WITH_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});

export const SWAPPABLE_DUTIES: SwapDutyType[] = [
  '피청',
  '커청',
  '건청',
  '간식',
  '본교팀장',
  '설거지',
  '화장실청소',
];

const DUTY_LABELS: Record<DutyType, string> = {
  피청: '피청',
  커청: '커청',
  건청: '건청',
  간식: '간식',
  본교팀장: '본교팀장',
  설거지: '설거지',
  화장실청소: '화장실청소',
};

export const DUTY_COLUMNS: DutyType[] = [
  '설거지',
  '피청',
  '커청',
  '건청',
  '간식',
  '본교팀장',
  '화장실청소',
];

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatShortDate(value: string): string {
  const date = parseDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatDate(value: string): string {
  return DATE_FORMATTER.format(parseDate(value));
}

export function formatDateCell(value: string): string {
  return DATE_CELL_FORMATTER.format(parseDate(value));
}

export function formatDateWithWeekday(value: string): string {
  return DATE_WITH_WEEKDAY_FORMATTER.format(parseDate(value));
}

export function isWeekend(value: string): boolean {
  const day = parseDate(value).getDay();
  return day === 0 || day === 6;
}

/** 대한민국 주요 공휴일(고정일): [MM-DD, 이름] */
const KOREAN_FIXED_HOLIDAYS: Array<[string, string]> = [
  ['01-01', '신정'],
  ['03-01', '삼일절'],
  ['05-05', '어린이날'],
  ['06-06', '현충일'],
  ['08-15', '광복절'],
  ['10-03', '개천절'],
  ['10-09', '한글날'],
  ['12-25', '크리스마스'],
];

/** 연도별 대한민국 공휴일 (음력·대체휴일 포함): [YYYY-MM-DD, 이름] */
const KOREAN_HOLIDAYS_BY_YEAR: Record<number, Record<string, string>> = {
  2026: {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일',
  '2026-06-06': '현충일',
  '2026-06-03': '전국동시지방선거',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스',
  },
  2027: {
    '2027-01-01': '신정',
    '2027-02-06': '설날 연휴',
    '2027-02-07': '설날',
    '2027-02-08': '설날 연휴',
    '2027-02-09': '대체공휴일',
    '2027-03-01': '삼일절',
    '2027-05-05': '어린이날',
    '2027-05-13': '부처님오신날',
    '2027-06-06': '현충일',
    '2027-06-07': '대체공휴일',
    '2027-08-15': '광복절',
    '2027-08-16': '대체공휴일',
    '2027-09-14': '추석 연휴',
    '2027-09-15': '추석',
    '2027-09-16': '추석 연휴',
    '2027-10-03': '개천절',
    '2027-10-04': '대체공휴일',
    '2027-10-09': '한글날',
    '2027-10-11': '대체공휴일',
    '2027-12-25': '크리스마스',
    '2027-12-27': '대체공휴일',
  },
};

/** 대한민국 공휴일 여부 (연도별 데이터 우선, 고정일 보조) */
export function isKoreanPublicHoliday(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const yearMap = KOREAN_HOLIDAYS_BY_YEAR[year];
  if (yearMap && value in yearMap) return true;
  const [, m, d] = value.split('-');
  const md = `${m}-${d}`;
  return KOREAN_FIXED_HOLIDAYS.some(([date]) => date === md);
}

/** 해당 날짜의 공휴일 이름 반환, 없으면 null (연도별 목록 우선) */
export function getKoreanPublicHolidayName(value: string): string | null {
  const year = Number(value.slice(0, 4));
  const yearMap = KOREAN_HOLIDAYS_BY_YEAR[year];
  if (yearMap && value in yearMap) return yearMap[value];
  const [, m, d] = value.split('-');
  const md = `${m}-${d}`;
  const found = KOREAN_FIXED_HOLIDAYS.find(([date]) => date === md);
  return found ? found[1] : null;
}

/** default 당번 있음. 경배일만 설거지 당번 없음(설거지 제외 다른 당번 유지) */
const NO_DISH_SCHEDULE_TYPES = ['경배일'];

/** 슬롯에 scheduleMemoType이 없으면 날짜 기준으로 공휴일/경배일 자동 보완 */
export function enrichSlotScheduleMemo(slot: ScheduleSlot): ScheduleSlot {
  const dutyEnabled = normalizeSlotDutyEnabled(slot.dutyEnabled);
  const isWednesday = getDayOfWeek(slot.date) === DAY_WEDNESDAY;

  /** 사용자가 scheduleMemoType을 지정한 경우 dutyEnabled를 덮어쓰지 않음 (당번 상세 체크 해제 등 존중) */
  if (slot.scheduleMemoType) {
    return slot;
  }

  const [, , d] = slot.date.split('-');
  const dayOfMonth = Number.parseInt(d, 10);
  /** 경배일과 공휴일이 겹치면 경배일 우선, 공휴일명은 상세에 기록 (1/1 신정, 3/1 삼일절, 8/15 광복절 등) */
  if (dayOfMonth === 1 || dayOfMonth === 15) {
    const holidayName = getKoreanPublicHolidayName(slot.date);
    return {
      ...slot,
      dutyEnabled: { ...dutyEnabled, 설거지: false },
      scheduleMemoType: '경배일',
      ...(holidayName ? { scheduleMemoDetail: holidayName } : {}),
    };
  }
  const holidayName = getKoreanPublicHolidayName(slot.date);
  if (holidayName) {
    return {
      ...slot,
      dutyEnabled: isWednesday ? { ...dutyEnabled, 설거지: false } : { ...dutyEnabled, 설거지: true },
      scheduleMemoType: '공휴일',
      scheduleMemoDetail: holidayName,
    };
  }
  if (isWednesday) {
    return { ...slot, dutyEnabled: { ...dutyEnabled, 설거지: false } };
  }
  return { ...slot, dutyEnabled: { ...dutyEnabled, 설거지: true } };
}

const DAY_SUNDAY = 0;
const DAY_WEDNESDAY = 3;
const DAY_SATURDAY = 6;
const NOT_APPLICABLE = '-';
const CUSTOM_BASE_YEAR = 2026;
const CUSTOM_2026_START_DATE = '2026-02-25';
const CUSTOM_2026_DUPLICATE_SATURDAY = '2026-02-28';
const CUSTOM_2026_LEADER_FIRST_DATE = '2026-02-25';
const CUSTOM_2026_LEADER_RANGE_START = '2026-02-28';
const CUSTOM_2026_LEADER_RANGE_END = '2026-03-02';
const CUSTOM_2026_MAIN_START_DATE = '2026-03-04';

export const SLOT_SELECTABLE_DUTIES: SlotSelectableDuty[] = [
  '피청',
  '커청',
  '건청',
  '간식',
  '본교팀장',
  '설거지',
];

const DEFAULT_SLOT_DUTY_ENABLED: SlotDutyEnabled = {
  피청: true,
  커청: true,
  건청: true,
  간식: true,
  본교팀장: true,
  설거지: true,
};

function getDayOfWeek(value: string): number {
  return parseDate(value).getDay();
}

function addDaysToDate(value: string, days: number): string {
  const d = parseDate(value);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * 주말블록: 토·일을 포함하는 연속일을 하나로 묶음.
 * 예) 금토일 → 한 블록, 토일월 → 한 블록. 주말팀장이 블록 전체 담당.
 */
function getWeekendBlocks(dutyDates: Set<string>): Map<string, string> {
  const dateToBlockKey = new Map<string, string>();
  const visited = new Set<string>();

  function expandBlock(startDate: string): string[] {
    const block: string[] = [];
    const stack = [startDate];
    while (stack.length > 0) {
      const d = stack.pop()!;
      if (visited.has(d)) continue;
      visited.add(d);
      block.push(d);
      for (const adj of [addDaysToDate(d, -1), addDaysToDate(d, 1)]) {
        if (dutyDates.has(adj)) stack.push(adj);
      }
    }
    return block;
  }

  const sortedDates = Array.from(dutyDates).sort();
  for (const date of sortedDates) {
    if (visited.has(date)) continue;
    const day = getDayOfWeek(date);
    if (day === DAY_SATURDAY || day === DAY_SUNDAY) {
      const block = expandBlock(date);
      const blockKey = [...block].sort()[0];
      for (const d of block) {
        dateToBlockKey.set(d, blockKey);
      }
    }
  }
  return dateToBlockKey;
}

function isSnackDay(day: number): boolean {
  return day === DAY_WEDNESDAY || day === DAY_SATURDAY || day === DAY_SUNDAY;
}

function getMonday(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(date);
  result.setDate(date.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

export function getWeekKey(value: string): string {
  const date = parseDate(value);
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekLabel(value: string): string {
  const date = parseDate(value);
  const monday = getMonday(date);
  const sunday = getSunday(date);
  return `${formatShortDate(toISODate(monday))}~${formatShortDate(toISODate(sunday))}`;
}

export function getMonthKey(value: string): string {
  return value.slice(0, 7);
}

export function getMonthLabel(value: string): string {
  const date = parseDate(value);
  return `${date.getMonth() + 1}월`;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDefaultSlot(date = new Date()): ScheduleSlot {
  return {
    id: makeId('slot'),
    date: toISODate(date),
    hasDuty: true,
    dutyEnabled: { ...DEFAULT_SLOT_DUTY_ENABLED },
  };
}

export function buildWeeklyPatternSlots(
  year: number,
  weekdays: number[] = [3, 6, 0],
): ScheduleSlot[] {
  const weekDaySet = new Set(weekdays);
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const slots: ScheduleSlot[] = [];
  let index = 1;

  for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    if (!weekDaySet.has(current.getDay())) {
      continue;
    }

    const dateStr = toISODate(current);
    const dayOfWeek = current.getDay();
    const holidayName = getKoreanPublicHolidayName(dateStr);
    const dayOfMonth = current.getDate();
    const isGyeongbaeDay = dayOfMonth === 1 || dayOfMonth === 15;
    const isWednesday = dayOfWeek === DAY_WEDNESDAY;

    let memo: { scheduleMemoType: '공휴일' | '경배일'; scheduleMemoDetail?: string } | object = {};
    let dutyEnabled = { ...DEFAULT_SLOT_DUTY_ENABLED };

    /** 경배일과 공휴일이 겹치면 경배일 우선, 공휴일명은 상세에 기록 */
    if (isGyeongbaeDay) {
      memo = {
        scheduleMemoType: '경배일' as const,
        ...(holidayName ? { scheduleMemoDetail: holidayName } : {}),
      };
      dutyEnabled = { ...DEFAULT_SLOT_DUTY_ENABLED, 설거지: false };
    } else if (holidayName) {
      memo = { scheduleMemoType: '공휴일' as const, scheduleMemoDetail: holidayName };
    }
    if (isWednesday) {
      dutyEnabled = { ...dutyEnabled, 설거지: false };
    }

    slots.push({
      id: `slot-${year}-${String(index).padStart(3, '0')}`,
      date: dateStr,
      hasDuty: true,
      dutyEnabled,
      ...memo,
    });
    index += 1;
  }

  return slots;
}

/** 다음 연도 슬롯 생성 (현재 마지막 날짜 이어서, 해당 연도 공휴일 적용) */
export function buildNextYearSlots(
  currentSlots: ScheduleSlot[],
  nextYear: number,
  weekdays: number[] = [3, 6, 0],
): ScheduleSlot[] {
  const nextSlots = buildWeeklyPatternSlots(nextYear, weekdays);
  return [...currentSlots, ...nextSlots];
}

export function buildCustom2026PatternSlots(weekdays: number[] = [3, 6, 0]): ScheduleSlot[] {
  const base = buildWeeklyPatternSlots(CUSTOM_BASE_YEAR, weekdays).filter(
    (slot) => slot.date >= CUSTOM_2026_START_DATE,
  );
  const firstSaturdayIndex = base.findIndex((slot) => slot.date === CUSTOM_2026_DUPLICATE_SATURDAY);

  if (firstSaturdayIndex >= 0) {
    const source = base[firstSaturdayIndex];
    base.splice(firstSaturdayIndex + 1, 0, {
      ...source,
      id: `${source.id}-dup`,
      dutyEnabled: normalizeSlotDutyEnabled(source.dutyEnabled),
    });
  }

  return base;
}

export function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sortSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  return [...slots].sort((a, b) => {
    if (a.date === b.date) {
      return a.id.localeCompare(b.id, 'ko');
    }
    return a.date.localeCompare(b.date);
  });
}

export function normalizeSlotDutyEnabled(
  dutyEnabled?: Partial<SlotDutyEnabled> | null,
): SlotDutyEnabled {
  return {
    ...DEFAULT_SLOT_DUTY_ENABLED,
    ...(dutyEnabled ?? {}),
  };
}

const SNACK_START_PERSON = '김희권';

function getSnackStartOffset(list: string[]): number {
  const idx = list.findIndex((n) => n === SNACK_START_PERSON);
  return idx >= 0 ? idx : 0;
}

function pick(list: string[], index: number): string {
  if (list.length === 0) {
    return '-';
  }
  return list[index % list.length];
}

function pickFromCustomStart(list: string[], customStart: string[], index: number): string {
  if (list.length === 0) {
    return NOT_APPLICABLE;
  }

  if (index < customStart.length) {
    const fixed = customStart[index];
    if (fixed) {
      return fixed;
    }
  }

  const anchor = customStart[customStart.length - 1];
  const anchorIndex = anchor ? list.findIndex((name) => name === anchor) : -1;
  const safeAnchorIndex = anchorIndex >= 0 ? anchorIndex : 0;
  const offset = Math.max(index - (customStart.length - 1), 0);
  return pick(list, safeAnchorIndex + offset);
}

function buildPairAssignment(first: string, second: string): string {
  if (!first || first === NOT_APPLICABLE) {
    return NOT_APPLICABLE;
  }
  if (!second || second === NOT_APPLICABLE || second === first) {
    return first;
  }
  return `${first}, ${second}`;
}

function pickPair(list: string[], index: number): string {
  if (list.length === 0) {
    return NOT_APPLICABLE;
  }
  return buildPairAssignment(pick(list, index), pick(list, index + 1));
}

/** 건관청소용: 2명씩 겹치지 않게 (1주 a,b / 2주 c,d / 3주 e,f) */
function pickPairNonOverlapping(list: string[], index: number): string {
  if (list.length === 0) {
    return NOT_APPLICABLE;
  }
  return buildPairAssignment(pick(list, index * 2), pick(list, index * 2 + 1));
}

/** 건관청소 커스텀 시작용: startPerson부터 2명씩 겹치지 않게 (첫 주 김보정,김주팔 → 다음주 김보활,노영신) */
function pickPairFromCustomStartNonOverlapping(
  list: string[],
  customStart: string[],
  index: number,
): string {
  if (list.length === 0) {
    return NOT_APPLICABLE;
  }
  const startIdx = list.findIndex((n) => n === customStart[0]);
  if (startIdx < 0) {
    return pickPairNonOverlapping(list, index);
  }
  return buildPairAssignment(
    pick(list, startIdx + index * 2),
    pick(list, startIdx + index * 2 + 1),
  );
}

function pickPairFromCustomStart(list: string[], customStart: string[], index: number): string {
  if (list.length === 0) {
    return NOT_APPLICABLE;
  }

  const first = pickFromCustomStart(list, customStart, index);
  const firstIndex = list.findIndex((name) => name === first);
  const secondIndex = firstIndex >= 0 ? firstIndex + 1 : index + 1;
  return buildPairAssignment(first, pick(list, secondIndex));
}

function getSortedTeamNames(map: Record<string, string[]>): string[] {
  return Object.keys(map).sort((a, b) => {
    const aNo = Number.parseInt(a, 10);
    const bNo = Number.parseInt(b, 10);
    if (Number.isNaN(aNo) || Number.isNaN(bNo)) {
      return a.localeCompare(b, 'ko');
    }
    return aNo - bNo;
  });
}

/** 설거지 당번 없음일 때 표시할 일정 라벨. 경배일과 겹치면 '경배일, {상세}' 형식 */
export function getScheduleLabelForNoDuty(slot: ScheduleSlot): string {
  const detail = slot.scheduleMemoDetail?.trim();
  const type = slot.scheduleMemoType ?? '';
  if (type === '경배일' && detail) return `경배일, ${detail}`;
  if (detail) return detail;
  return type;
}

/** 일정 메모 표시 텍스트 생성 (scheduleMemoType/scheduleMemoDetail 우선, noDutyMemo 폴백) */
export function getScheduleMemoDisplay(slot: ScheduleSlot): string {
  if (slot.scheduleMemoType) {
    const detail = slot.scheduleMemoDetail?.trim();
    if (detail && ['기령일', '경배일', '공휴일', '연휴', '기타'].includes(slot.scheduleMemoType)) {
      return `${slot.scheduleMemoType}: ${detail}`;
    }
    return slot.scheduleMemoType;
  }
  return slot.noDutyMemo ?? '';
}

function noDutyAssignments(slot: ScheduleSlot): DutyAssignments {
  const memoDisplay = getScheduleMemoDisplay(slot);
  const memo = memoDisplay ? ` (${memoDisplay})` : '';
  const text = `당번 없음${memo}`;
  return {
    피청: text,
    커청: text,
    건청: text,
    간식: text,
    본교팀장: text,
    설거지: text,
    화장실청소: text,
  };
}

interface WeekRotationState {
  hasWednesdayDuty: boolean;
  hasSnackDuty: boolean;
  snackIndex: number | null;
  weekdayLeaderIndex: number | null;
}

function formatTeamWithMembers(teamName: string, teams: Record<string, string[]>): string {
  if (!teamName || teamName === NOT_APPLICABLE) {
    return NOT_APPLICABLE;
  }

  const members = teams[teamName] ?? [];
  if (members.length === 0) {
    return teamName;
  }

  return `${teamName} (${members.join(', ')})`;
}

export function parseTeamWithMembers(value: string): { teamName: string; members: string[] } | null {
  if (!value || value === NOT_APPLICABLE) {
    return null;
  }

  const match = value.match(/^(.+?)\s*\((.*)\)$/);
  if (!match) {
    return null;
  }

  const teamName = match[1].trim();
  const members = match[2]
    .split(',')
    .map((member) => member.trim())
    .filter(Boolean);

  return { teamName, members };
}

function buildTeamWithMembers(teamName: string, members: string[]): string {
  return `${teamName} (${members.join(', ')})`;
}

function replaceTeamMember(value: string, fromPerson: string, toPerson: string): string {
  const parsed = parseTeamWithMembers(value);
  if (!parsed) {
    return value;
  }

  const targetIndex = parsed.members.findIndex((member) => member === fromPerson);
  if (targetIndex < 0) {
    return value;
  }

  const nextMembers = [...parsed.members];
  nextMembers[targetIndex] = toPerson;
  return buildTeamWithMembers(parsed.teamName, nextMembers);
}

function parseCommaMembers(value: string): string[] | null {
  if (!value || value === NOT_APPLICABLE || value.startsWith('당번 없음')) {
    return null;
  }

  const members = value
    .split(',')
    .map((member) => member.trim())
    .filter(Boolean);

  if (members.length === 0) {
    return null;
  }

  return members;
}

function replaceCommaMember(value: string, fromPerson: string, toPerson: string): string {
  const members = parseCommaMembers(value);
  if (!members) {
    return value;
  }

  const targetIndex = members.findIndex((member) => member === fromPerson);
  if (targetIndex < 0) {
    return value;
  }

  const nextMembers = [...members];
  nextMembers[targetIndex] = toPerson;
  return nextMembers.join(', ');
}

function formatSwapLogDate(value: string): string {
  const date = parseDate(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function addChangeNote(row: AssignmentRow, dutyType: DutyType, note: ChangeNote): void {
  const current = row.changeNotes[dutyType] ?? [];
  row.changeNotes[dutyType] = [...current, note];
}

function addChangedPerson(row: AssignmentRow, dutyType: DutyType, person: string): void {
  if (!person || person === NOT_APPLICABLE) {
    return;
  }
  const current = row.changedPeople[dutyType] ?? [];
  if (current.includes(person)) {
    return;
  }
  row.changedPeople[dutyType] = [...current, person];
}

function applyChangeLog(rows: AssignmentRow[], logs: ChangeLogEntry[]): AssignmentRow[] {
  if (logs.length === 0) {
    return rows;
  }

  const mapped = rows.map((row) => ({
    ...row,
    assignments: { ...row.assignments },
    changeNotes: { ...row.changeNotes },
    changedPeople: { ...row.changedPeople },
  }));
  const rowById = new Map(mapped.map((row) => [row.slot.id, row]));

  logs.forEach((log) => {
    const rowA = rowById.get(log.cellA.slotId);
    const rowB = rowById.get(log.cellB.slotId);

    if (!rowA || !rowB) {
      return;
    }

    const duty = log.dutyType;
    const currentA = rowA.assignments[duty as keyof DutyAssignments];
    const currentB = rowB.assignments[duty as keyof DutyAssignments];

    if (typeof currentA !== 'string' || typeof currentB !== 'string') {
      return;
    }

    if (log.isSubstitute) {
      // 대신하기: 한 칸만 변경, cellA와 cellB는 같은 슬롯
      if (duty === '설거지' || duty === '화장실청소') {
        rowA.assignments[duty] = replaceTeamMember(currentA, log.cellA.person, log.cellB.person);
      } else if (duty === '건청') {
        rowA.assignments[duty] = replaceCommaMember(currentA, log.cellA.person, log.cellB.person);
      } else {
        rowA.assignments[duty as keyof DutyAssignments] = log.cellB.person;
      }
      const message = `${log.cellB.person}가 ${log.cellA.person}의 것을 대신함`;
      const note: ChangeNote = { logId: log.id, message };
      addChangeNote(rowA, duty, note);
      addChangedPerson(rowA, duty, log.cellB.person);
    } else {
      if (duty === '설거지' || duty === '화장실청소') {
        rowA.assignments[duty] = replaceTeamMember(currentA, log.cellA.person, log.cellB.person);
        rowB.assignments[duty] = replaceTeamMember(currentB, log.cellB.person, log.cellA.person);
      } else if (duty === '건청') {
        rowA.assignments[duty] = replaceCommaMember(currentA, log.cellA.person, log.cellB.person);
        rowB.assignments[duty] = replaceCommaMember(currentB, log.cellB.person, log.cellA.person);
      } else {
        rowA.assignments[duty as keyof DutyAssignments] = currentB;
        rowB.assignments[duty as keyof DutyAssignments] = currentA;
      }
      const message = `${formatSwapLogDate(log.cellB.date)} ${log.cellB.person} ↔ ${formatSwapLogDate(log.cellA.date)} ${log.cellA.person}`;
      const note: ChangeNote = { logId: log.id, message };
      addChangeNote(rowA, duty, note);
      addChangeNote(rowB, duty, note);
      addChangedPerson(rowA, duty, log.cellB.person);
      addChangedPerson(rowB, duty, log.cellA.person);
    }
  });

  return mapped;
}

export function getDutyLabel(duty: DutyType): string {
  return DUTY_LABELS[duty];
}

export function computeAssignmentRows(data: ScheduleData): AssignmentRow[] {
  const rows: AssignmentRow[] = [];
  const sorted = sortSlots(data.schedule);
  const main = data.rosters.피청커청건청;
  const snack = data.rosters.간식;
  const weekdayLeaders = data.rosters.본교팀장주중;
  const weekendLeaders = data.rosters.본교팀장주말;
  const dishTeams = getSortedTeamNames(data.teams.설거지);
  const restroomTeams = getSortedTeamNames(data.teams.화장실청소);
  const weekStateMap = new Map<string, WeekRotationState>();
  const restroomMonthIndexMap = new Map<string, number>();

  sorted.forEach((slot) => {
    const weekKey = getWeekKey(slot.date);
    if (!weekStateMap.has(weekKey)) {
      weekStateMap.set(weekKey, {
        hasWednesdayDuty: false,
        hasSnackDuty: false,
        snackIndex: null,
        weekdayLeaderIndex: null,
      });
    }

    if (!slot.hasDuty) {
      return;
    }

    const dutyEnabled = normalizeSlotDutyEnabled(slot.dutyEnabled);
    const state = weekStateMap.get(weekKey)!;
    const day = getDayOfWeek(slot.date);
    if (day === DAY_WEDNESDAY) {
      state.hasWednesdayDuty = true;
    }
    if (isSnackDay(day) && dutyEnabled.간식) {
      state.hasSnackDuty = true;
    }

    const monthKey = getMonthKey(slot.date);
    if (!restroomMonthIndexMap.has(monthKey)) {
      restroomMonthIndexMap.set(monthKey, restroomMonthIndexMap.size);
    }
  });

  const dutyDates = new Set(
    sorted.filter((s) => s.hasDuty).map((s) => s.date),
  );
  const dateToWeekendBlock = getWeekendBlocks(dutyDates);
  const weekendBlockKeys = [...new Set(dateToWeekendBlock.values())].sort();
  const weekendBlockKeyToLeaderIndex = new Map<string, number>(
    weekendBlockKeys.map((k, i) => [k, i]),
  );

  let weeklySnackIndex = 0;
  let weekdayLeaderIndex = 0;

  weekStateMap.forEach((state) => {
    if (state.hasSnackDuty) {
      state.snackIndex = weeklySnackIndex;
      weeklySnackIndex += 1;
    }

    if (state.hasWednesdayDuty) {
      state.weekdayLeaderIndex = weekdayLeaderIndex;
      weekdayLeaderIndex += 1;
    }
  });

  const mainDutyWeeks = new Set<string>();
  sorted.forEach((slot) => {
    if (!slot.hasDuty) return;
    const dutyEnabled = normalizeSlotDutyEnabled(slot.dutyEnabled);
    const hasMainDutyEnabled = dutyEnabled.피청 || dutyEnabled.커청 || dutyEnabled.건청;
    if (hasMainDutyEnabled) {
      mainDutyWeeks.add(getWeekKey(slot.date));
    }
  });

  const mainDutyIndexByWeek = new Map<string, number>();
  let mainDutyWeekIndex = 0;
  mainDutyWeeks.forEach((weekKey) => {
    mainDutyIndexByWeek.set(weekKey, mainDutyWeekIndex);
    mainDutyWeekIndex += 1;
  });

  const mainDutyIndexBySlotId = new Map<string, number | null>();
  sorted.forEach((slot) => {
    if (!slot.hasDuty) {
      mainDutyIndexBySlotId.set(slot.id, null);
      return;
    }
    const dutyEnabled = normalizeSlotDutyEnabled(slot.dutyEnabled);
    const hasMainDutyEnabled = dutyEnabled.피청 || dutyEnabled.커청 || dutyEnabled.건청;
    if (!hasMainDutyEnabled) {
      mainDutyIndexBySlotId.set(slot.id, null);
      return;
    }
    const weekKey = getWeekKey(slot.date);
    const index = mainDutyIndexByWeek.get(weekKey);
    mainDutyIndexBySlotId.set(slot.id, index !== undefined ? index : null);
  });

  let dutyIndex = 0;
  let dishSlotIndex = 0;
  const saturdayDishByWeek = new Map<string, string>();
  const restroomAssignedMonthSet = new Set<string>();
  const sameDateCountMap = new Map<string, number>();
  const custom2026MainOrderByMainIndex = new Map<number, number>();

  sorted.forEach((slot) => {
    const weekKey = getWeekKey(slot.date);
    const weekLabel = getWeekLabel(slot.date);
    const monthKey = getMonthKey(slot.date);
    const monthLabel = getMonthLabel(slot.date);

    if (!slot.hasDuty) {
      rows.push({
        slot,
        dutySlotIndex: null,
        weekKey,
        weekLabel,
        monthKey,
        monthLabel,
        assignments: noDutyAssignments(slot),
        changeNotes: {},
        changedPeople: {},
      });
      return;
    }

    const day = getDayOfWeek(slot.date);
    const isSaturday = day === DAY_SATURDAY;
    const isSunday = day === DAY_SUNDAY;
    const isWednesday = day === DAY_WEDNESDAY;
    const isCustom2026Date = slot.date.startsWith(`${CUSTOM_BASE_YEAR}-`);
    const weekState = weekStateMap.get(weekKey);
    const dutyEnabled = normalizeSlotDutyEnabled(slot.dutyEnabled);
    const mainDutyIndex = mainDutyIndexBySlotId.get(slot.id) ?? null;
    const sameDateCount = (sameDateCountMap.get(slot.date) ?? 0) + 1;
    sameDateCountMap.set(slot.date, sameDateCount);
    let custom2026MainWeekOrder: number | null = null;

    if (isCustom2026Date && slot.date >= CUSTOM_2026_MAIN_START_DATE && mainDutyIndex !== null) {
      if (!custom2026MainOrderByMainIndex.has(mainDutyIndex)) {
        custom2026MainOrderByMainIndex.set(mainDutyIndex, custom2026MainOrderByMainIndex.size);
      }
      custom2026MainWeekOrder = custom2026MainOrderByMainIndex.get(mainDutyIndex)!;
    }

    const mainPerson = mainDutyIndex !== null ? pick(main, mainDutyIndex) : NOT_APPLICABLE;
    const mainPair =
      mainDutyIndex !== null ? pickPairNonOverlapping(main, mainDutyIndex) : NOT_APPLICABLE;
    const snackPerson =
      weekState && weekState.snackIndex !== null
        ? pick(snack, getSnackStartOffset(snack) + weekState.snackIndex)
        : NOT_APPLICABLE;
    const weekdayLeader =
      weekState && weekState.weekdayLeaderIndex !== null
        ? pick(weekdayLeaders, weekState.weekdayLeaderIndex)
        : NOT_APPLICABLE;
    const weekendBlockKey = dateToWeekendBlock.get(slot.date);
    const weekendLeader =
      weekendBlockKey !== undefined
        ? pick(
            weekendLeaders,
            weekendBlockKeyToLeaderIndex.get(weekendBlockKey) ?? 0,
          )
        : NOT_APPLICABLE;

    let dishTeam = NOT_APPLICABLE;
    if (dutyEnabled.설거지) {
      if (isSaturday) {
        const isCustomFirstSaturday =
          slot.date === CUSTOM_2026_DUPLICATE_SATURDAY && sameDateCount === 1;
        const isCustomSecondSaturday =
          slot.date === CUSTOM_2026_DUPLICATE_SATURDAY && sameDateCount === 2;

        if (isCustomFirstSaturday) {
          dishTeam = NOT_APPLICABLE;
        } else if (isCustomSecondSaturday) {
          const forcedTeam = dishTeams.find((team) => team === '1팀');
          dishTeam = forcedTeam ?? pick(dishTeams, dishSlotIndex);
          saturdayDishByWeek.set(weekKey, dishTeam);
          dishSlotIndex += 1;
        } else {
          dishTeam = pick(dishTeams, dishSlotIndex);
          saturdayDishByWeek.set(weekKey, dishTeam);
          dishSlotIndex += 1;
        }
      } else if (isSunday) {
        const saturdayDish = saturdayDishByWeek.get(weekKey);
        dishTeam = pick(dishTeams, dishSlotIndex);
        if (dishTeams.length > 1 && saturdayDish && dishTeam === saturdayDish) {
          dishSlotIndex += 1;
          dishTeam = pick(dishTeams, dishSlotIndex);
        }
        dishSlotIndex += 1;
      } else {
        dishTeam = pick(dishTeams, dishSlotIndex);
        dishSlotIndex += 1;
      }
    }

    const assignments: DutyAssignments = {
      피청: mainDutyIndex !== null ? mainPerson : NOT_APPLICABLE,
      커청: mainDutyIndex !== null ? mainPerson : NOT_APPLICABLE,
      건청: mainDutyIndex !== null ? mainPair : NOT_APPLICABLE,
      간식: isSnackDay(day) ? snackPerson : NOT_APPLICABLE,
      본교팀장: isWednesday ? weekdayLeader : weekendLeader,
      설거지: formatTeamWithMembers(dishTeam, data.teams.설거지),
      화장실청소: (() => {
        if (restroomAssignedMonthSet.has(monthKey)) {
          return NOT_APPLICABLE;
        }
        const monthIndex = restroomMonthIndexMap.get(monthKey);
        if (monthIndex === undefined) {
          return NOT_APPLICABLE;
        }
        restroomAssignedMonthSet.add(monthKey);
        return formatTeamWithMembers(pick(restroomTeams, monthIndex), data.teams.화장실청소);
      })(),
    };

    if (isCustom2026Date) {
      if (slot.date === CUSTOM_2026_LEADER_FIRST_DATE) {
        assignments.본교팀장 = '김명세';
      } else if (
        slot.date >= CUSTOM_2026_LEADER_RANGE_START &&
        slot.date <= CUSTOM_2026_LEADER_RANGE_END
      ) {
        assignments.본교팀장 = '김희권';
      }

      if (slot.date < CUSTOM_2026_MAIN_START_DATE) {
        assignments.피청 = '';
        assignments.커청 = '';
        assignments.건청 = '';
      } else if (custom2026MainWeekOrder !== null) {
        assignments.피청 = pickFromCustomStart(main, ['김희권'], custom2026MainWeekOrder);
        assignments.커청 = pickFromCustomStart(main, ['임주현'], custom2026MainWeekOrder);
        assignments.건청 = pickPairFromCustomStartNonOverlapping(
          main,
          ['김보정', '김주팔'],
          custom2026MainWeekOrder,
        );
      }
    }

    SLOT_SELECTABLE_DUTIES.forEach((duty) => {
      if (!dutyEnabled[duty]) {
        assignments[duty] =
          duty === '설거지' ? getScheduleLabelForNoDuty(slot) : '';
      }
    });

    rows.push({
      slot,
      dutySlotIndex: dutyIndex,
      weekKey,
      weekLabel,
      monthKey,
      monthLabel,
      assignments,
      changeNotes: {},
      changedPeople: {},
    });

    dutyIndex += 1;
  });

  return applyChangeLog(rows, data.changeLog);
}

export function matchesSearch(row: AssignmentRow, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return true;
  }

  const keyword = trimmed.toLowerCase();
  return Object.values(row.assignments).some((value) => value.toLowerCase().includes(keyword));
}
