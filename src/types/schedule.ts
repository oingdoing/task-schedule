export type TeamCategory = '설거지' | '화장실청소';

export type RosterCategory =
  | '피청커청건청'
  | '간식'
  | '본교팀장주중'
  | '본교팀장주말';

export type DutyType =
  | '피청'
  | '커청'
  | '건청'
  | '간식'
  | '본교팀장'
  | '설거지'
  | '화장실청소';

export type SlotSelectableDuty = '피청' | '커청' | '건청' | '간식' | '본교팀장' | '설거지';

export type SlotDutyEnabled = Record<SlotSelectableDuty, boolean>;

export type SwapDutyType =
  | '피청'
  | '커청'
  | '건청'
  | '간식'
  | '본교팀장'
  | '설거지'
  | '화장실청소';

export interface Teams {
  설거지: Record<string, string[]>;
  화장실청소: Record<string, string[]>;
}

export interface Rosters {
  피청커청건청: string[];
  간식: string[];
  본교팀장주중: string[];
  본교팀장주말: string[];
}

export type ScheduleMemoType =
  | '기령일'
  | '경배일'
  | '경신공부'
  | '현장학습'
  | '월례교학'
  | '공휴일'
  | '연휴'
  | '기타';

export const SCHEDULE_MEMO_TYPES: ScheduleMemoType[] = [
  '기령일',
  '경배일',
  '경신공부',
  '현장학습',
  '월례교학',
  '공휴일',
  '연휴',
  '기타',
];

/** 공휴일, 연휴, 기타, 기령일 선택 시 상세 입력 활성화 */
export const SCHEDULE_MEMO_TYPES_WITH_DETAIL: ScheduleMemoType[] = ['기령일', '경배일', '공휴일', '연휴', '기타'];

export interface ScheduleSlot {
  id: string;
  date: string;
  hasDuty: boolean;
  /** @deprecated scheduleMemoType/scheduleMemoDetail 사용 권장 */
  noDutyMemo?: string;
  /** 일정 종류 (기령일, 경배일 등) */
  scheduleMemoType?: ScheduleMemoType;
  /** 공휴일/연휴/기타 선택 시 자세한 사항 */
  scheduleMemoDetail?: string;
  dutyEnabled?: SlotDutyEnabled;
}

export interface SwapCellRef {
  slotId: string;
  date: string;
  person: string;
}

export interface ChangeLogEntry {
  id: string;
  date: string;
  dutyType: DutyType;
  cellA: SwapCellRef;
  cellB: SwapCellRef;
  /** true면 교환이 아닌 '대신하기' (한 칸만 변경) */
  isSubstitute?: boolean;
}

export interface ScheduleData {
  teams: Teams;
  rosters: Rosters;
  schedule: ScheduleSlot[];
  changeLog: ChangeLogEntry[];
}

export interface ChangeNote {
  logId: string;
  message: string;
}

export interface DutyAssignments {
  피청: string;
  커청: string;
  건청: string;
  간식: string;
  본교팀장: string;
  설거지: string;
  화장실청소: string;
}

export interface AssignmentRow {
  slot: ScheduleSlot;
  dutySlotIndex: number | null;
  weekKey: string;
  weekLabel: string;
  monthKey: string;
  monthLabel: string;
  assignments: DutyAssignments;
  changeNotes: Partial<Record<DutyType, ChangeNote[]>>;
  changedPeople: Partial<Record<DutyType, string[]>>;
}
