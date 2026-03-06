import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import YearNavigator from './components/YearNavigator';
import ScheduleTable from './components/ScheduleTable';
import WeekDetailPanel from './components/WeekDetailPanel';
import EmptyState from './components/EmptyState';
import EditDateModal from './components/EditDateModal';
import EditRosterModal from './components/EditRosterModal';
import ConfirmCodeModal from './components/ConfirmCodeModal';
import EntryGate, { getEntryState } from './components/EntryGate';
import AdminCodeModal from './components/AdminCodeModal';
import UsageGuideModal from './components/UsageGuideModal';
import { useSwapMode } from './hooks/useSwapMode';
import initialDataJson from './data/schedule.json';
import type {
  AssignmentRow,
  ChangeLogEntry,
  ScheduleData,
  ScheduleSlot,
  SwapDutyType,
  Teams,
  Rosters,
} from './types/schedule';
import {
  buildCustom2026PatternSlots,
  buildNextYearSlots,
  buildWeeklyPatternSlots,
  computeAssignmentRows,
  enrichSlotScheduleMemo,
  formatDateWithWeekday,
  makeId,
  matchesSearch,
  normalizeSlotDutyEnabled,
  sortSlots,
  toISODate,
} from './utils/rotation';

const STORAGE_KEY = 'duty-schedule-data-v1';
const SEED_SIGNATURE_KEY = 'duty-schedule-seed-signature-v1';
const YEAR_EXTEND_CONFIRM_CODE = '생성확인';
const DOCUMENT_CODE = '열심히합니다';
const ADMIN_CODE = 'ohiing7301!@';
const DEFAULT_START_YEAR = 2026;
const DEFAULT_WEEKDAYS = [3, 6, 0];
const CUSTOM_2026_START_DATE = '2026-02-25';
const CUSTOM_2026_DUPLICATE_SATURDAY = '2026-02-28';
const TEAM_MEMBER_LIMITS: Record<keyof Teams, number> = {
  설거지: 3,
  화장실청소: 2,
};
function buildDefaultSchedule(): ScheduleSlot[] {
  if (DEFAULT_START_YEAR === 2026) {
    return buildCustom2026PatternSlots(DEFAULT_WEEKDAYS);
  }
  return buildWeeklyPatternSlots(DEFAULT_START_YEAR, DEFAULT_WEEKDAYS);
}

function enforceCustom2026Schedule(slots: ScheduleSlot[]): ScheduleSlot[] {
  const filtered = slots.filter(
    (slot) => !slot.date.startsWith('2026-') || slot.date >= CUSTOM_2026_START_DATE,
  );
  const sorted = sortSlots(filtered);
  const duplicateTargets = sorted
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.date === CUSTOM_2026_DUPLICATE_SATURDAY);

  if (duplicateTargets.length === 1) {
    const source = duplicateTargets[0].slot;
    sorted.splice(duplicateTargets[0].index + 1, 0, {
      ...source,
      id: `${source.id}-dup`,
      dutyEnabled: normalizeSlotDutyEnabled(source.dutyEnabled),
    });
  }

  return sorted;
}

function normalizeScheduleSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  const normalized = slots.map((slot) =>
    enrichSlotScheduleMemo({
      ...slot,
      dutyEnabled: normalizeSlotDutyEnabled(slot.dutyEnabled),
    }),
  );
  return enforceCustom2026Schedule(normalized);
}

function normalizeTeamMembers(members: string[], limit: number): string[] {
  const next = members.slice(0, limit);
  while (next.length < limit) {
    next.push('');
  }
  return next;
}

function normalizeTeams(teams: Teams): Teams {
  return {
    설거지: Object.fromEntries(
      Object.entries(teams.설거지).map(([teamName, members]) => [
        teamName,
        normalizeTeamMembers(members ?? [], TEAM_MEMBER_LIMITS.설거지),
      ]),
    ),
    화장실청소: Object.fromEntries(
      Object.entries(teams.화장실청소).map(([teamName, members]) => [
        teamName,
        normalizeTeamMembers(members ?? [], TEAM_MEMBER_LIMITS.화장실청소),
      ]),
    ),
  };
}

function normalizeRosterMembers(members: string[] | undefined): string[] {
  return (members ?? []).map((member) => member.trim()).filter(Boolean);
}

function normalizeRosters(rosters: Rosters): Rosters {
  return {
    피청커청건청: normalizeRosterMembers(rosters.피청커청건청),
    간식: normalizeRosterMembers(rosters.간식),
    본교팀장주중: normalizeRosterMembers(rosters.본교팀장주중),
    본교팀장주말: normalizeRosterMembers(rosters.본교팀장주말),
  };
}

function buildSeedSignature(data: Pick<ScheduleData, 'teams' | 'rosters'>): string {
  return JSON.stringify({ teams: data.teams, rosters: data.rosters });
}

function cloneData(data: ScheduleData): ScheduleData {
  const normalizedTeams = normalizeTeams(data.teams);
  const normalizedRosters = normalizeRosters(data.rosters);
  return {
    teams: {
      설거지: Object.fromEntries(
        Object.entries(normalizedTeams.설거지).map(([team, members]) => [team, [...members]]),
      ),
      화장실청소: Object.fromEntries(
        Object.entries(normalizedTeams.화장실청소).map(([team, members]) => [team, [...members]]),
      ),
    },
    rosters: {
      피청커청건청: [...normalizedRosters.피청커청건청],
      간식: [...normalizedRosters.간식],
      본교팀장주중: [...normalizedRosters.본교팀장주중],
      본교팀장주말: [...normalizedRosters.본교팀장주말],
    },
    schedule: normalizeScheduleSlots(data.schedule),
    changeLog: data.changeLog.map((entry) => ({
      ...entry,
      cellA: { ...entry.cellA },
      cellB: { ...entry.cellB },
    })),
  };
}

function baseData(): ScheduleData {
  const initial = cloneData(initialDataJson as ScheduleData);
  if (initial.schedule.length > 0) {
    return initial;
  }
  return {
    ...initial,
    schedule: buildDefaultSchedule(),
  };
}

const DEFAULT_SEED_SIGNATURE = buildSeedSignature(baseData());

function loadData(): ScheduleData {
  if (typeof window === 'undefined') {
    return baseData();
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return baseData();
    }

    const parsed = JSON.parse(saved) as Partial<ScheduleData>;
    const fallback = baseData();
    const savedSeedSignature = window.localStorage.getItem(SEED_SIGNATURE_KEY);
    const shouldApplySeedData = savedSeedSignature !== DEFAULT_SEED_SIGNATURE;
    const savedSchedule = Array.isArray(parsed.schedule)
      ? normalizeScheduleSlots(parsed.schedule as ScheduleSlot[])
      : fallback.schedule;
    const merged: ScheduleData = {
      teams: shouldApplySeedData ? fallback.teams : parsed.teams ?? fallback.teams,
      rosters: shouldApplySeedData ? fallback.rosters : parsed.rosters ?? fallback.rosters,
      schedule: savedSchedule,
      changeLog: parsed.changeLog ?? fallback.changeLog,
    };

    if (merged.schedule.length > 0) {
      return merged;
    }

    return {
      ...merged,
      schedule: buildDefaultSchedule(),
    };
  } catch {
    return baseData();
  }
}

function getInitialYear(data: ScheduleData): number {
  if (data.schedule.length === 0) {
    return new Date().getFullYear();
  }
  return Number(data.schedule[0].date.slice(0, 4));
}

function formatMonthDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function buildChangeSummary(log: ChangeLogEntry): string {
  return `${formatMonthDay(log.cellB.date)} ${log.cellB.person} ↔ ${formatMonthDay(log.cellA.date)} ${log.cellA.person}`;
}

export default function App() {
  const [entryState, setEntryState] = useState(() => getEntryState());
  const [isAdminCodeModalOpen, setAdminCodeModalOpen] = useState(false);
  const [data, setData] = useState<ScheduleData>(() => loadData());
  const [currentYear, setCurrentYear] = useState<number>(() => getInitialYear(loadData()));
  const [searchQuery, setSearchQuery] = useState('');
  const [weekDetailKey, setWeekDetailKey] = useState<string | null>(null);
  const [isDateModalOpen, setDateModalOpen] = useState(false);
  const [isRosterModalOpen, setRosterModalOpen] = useState(false);
  const [isConfirmCodeModalOpen, setConfirmCodeModalOpen] = useState(false);
  const [isUsageGuideOpen, setUsageGuideOpen] = useState(false);
  const swapMode = useSwapMode();

  const hasDataForYear = (year: number) =>
    data.schedule.some((slot) => Number(slot.date.slice(0, 4)) === year);

  const handleNextYear = () => {
    const nextY = currentYear + 1;
    if (hasDataForYear(nextY)) {
      setCurrentYear(nextY);
      return;
    }
    const ok = window.confirm('다음 연도의 데이터를 생성하시겠습니까?');
    if (!ok) return;
    setConfirmCodeModalOpen(true);
  };

  const handleConfirmExtendYear = () => {
    setConfirmCodeModalOpen(false);
    const nextY = currentYear + 1;
    const currentSlots = data.schedule.filter((s) => Number(s.date.slice(0, 4)) <= currentYear);
    const extended = buildNextYearSlots(currentSlots, nextY, DEFAULT_WEEKDAYS);
    setData((prev) => ({ ...prev, schedule: normalizeScheduleSlots(extended) }));
    setCurrentYear(nextY);
    window.alert(`${nextY}년 데이터가 생성되었습니다.`);
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.localStorage.setItem(SEED_SIGNATURE_KEY, DEFAULT_SEED_SIGNATURE);
  }, [data]);

  const allRows = useMemo(() => computeAssignmentRows(data), [data]);

  const yearRows = useMemo(
    () => allRows.filter((row) => Number(row.slot.date.slice(0, 4)) === currentYear),
    [allRows, currentYear],
  );

  const visibleRows = useMemo(
    () => yearRows.filter((row) => matchesSearch(row, searchQuery)),
    [yearRows, searchQuery],
  );

  const weekDetailRows = useMemo(() => {
    if (!weekDetailKey) {
      return [];
    }
    return yearRows.filter((row) => row.weekKey === weekDetailKey);
  }, [yearRows, weekDetailKey]);

  const weekDetailLabel = useMemo(() => weekDetailRows[0]?.weekLabel ?? null, [weekDetailRows]);

  useEffect(() => {
    if (!weekDetailKey) {
      return;
    }
    if (!yearRows.some((row) => row.weekKey === weekDetailKey)) {
      setWeekDetailKey(null);
    }
  }, [weekDetailKey, yearRows]);

  const handleSwapClick = (row: AssignmentRow, dutyType: SwapDutyType, targetPerson?: string) => {
    const person = targetPerson ?? row.assignments[dutyType];

    const target = {
      slotId: row.slot.id,
      date: row.slot.date,
      dutyType,
      person,
    };

    if (!swapMode.source) {
      const confirmed = window.confirm('담당자를 바꾸시겠습니까?');
      if (!confirmed) {
        return;
      }
      swapMode.selectSource(target);
      return;
    }

    const source = swapMode.source;

    if (source.slotId === target.slotId && source.dutyType === target.dutyType) {
      swapMode.reset();
      return;
    }

    if (source.dutyType !== target.dutyType) {
      window.alert('같은 업무 항목끼리만 교환할 수 있습니다.');
      return;
    }

    const confirmed = window.confirm(
      `${formatDateWithWeekday(source.date)} ${source.person} ↔ ${formatDateWithWeekday(target.date)} ${target.person}\n이 사람과 바꾸시겠습니까?`,
    );

    if (!confirmed) {
      return;
    }

    const entry: ChangeLogEntry = {
      id: makeId('log'),
      date: toISODate(new Date()),
      dutyType: source.dutyType,
      cellA: {
        slotId: source.slotId,
        date: source.date,
        person: source.person,
      },
      cellB: {
        slotId: target.slotId,
        date: target.date,
        person: target.person,
      },
    };

    setData((prev) => ({
      ...prev,
      changeLog: [...prev.changeLog, entry],
    }));
    swapMode.reset();
  };

  const saveSlots = (slots: ScheduleSlot[]) => {
    setData((prev) => {
      const otherYears = prev.schedule.filter(
        (s) => Number(s.date.slice(0, 4)) !== currentYear,
      );
      const merged = [...otherYears, ...slots];
      return { ...prev, schedule: normalizeScheduleSlots(merged) };
    });
  };

  const saveRosters = (payload: { teams: Teams; rosters: Rosters }) => {
    setData((prev) => ({
      ...prev,
      teams: normalizeTeams(payload.teams),
      rosters: normalizeRosters(payload.rosters),
    }));
  };

  const undoChange = (id: string) => {
    const index = data.changeLog.findIndex((log) => log.id === id);
    if (index < 0) {
      return;
    }

    const target = data.changeLog[index];
    const confirmed = window.confirm(`${buildChangeSummary(target)}\n이 변경 내역을 취소하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setData((prev) => ({
      ...prev,
      changeLog: prev.changeLog.slice(0, index),
    }));
  };

  if (!entryState.passed) {
    return (
      <div className="app-shell">
        <Header onOpenUsageGuide={() => setUsageGuideOpen(true)} />
        <EntryGate
          documentCode={DOCUMENT_CODE}
          onPass={(isAdmin) => setEntryState({ passed: true, isAdmin })}
          onOpenAdminModal={() => setAdminCodeModalOpen(true)}
        />
        <AdminCodeModal
          isOpen={isAdminCodeModalOpen}
          expectedCode={ADMIN_CODE}
          onConfirm={() => {
            setAdminCodeModalOpen(false);
            setEntryState({ passed: true, isAdmin: true });
          }}
          onClose={() => setAdminCodeModalOpen(false)}
        />
        <UsageGuideModal
          isOpen={isUsageGuideOpen}
          onClose={() => setUsageGuideOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header onOpenUsageGuide={() => setUsageGuideOpen(true)} />

      <YearNavigator
        year={currentYear}
        disablePrevYear={currentYear <= DEFAULT_START_YEAR}
        onPrevYear={() => setCurrentYear((prev) => Math.max(DEFAULT_START_YEAR, prev - 1))}
        onNextYear={handleNextYear}
      />

      <section className="actions card">
        <label className="search-box">
          <span>담당자 검색</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름을 입력하세요"
          />
        </label>
        <div className="action-buttons">
          {swapMode.source && (
            <button type="button" className="secondary" onClick={swapMode.reset}>
              교환 취소
            </button>
          )}
          {entryState.isAdmin && (
            <>
              <button type="button" onClick={() => setDateModalOpen(true)}>
                날짜 수정
              </button>
              <button type="button" onClick={() => setRosterModalOpen(true)}>
                명단 수정
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  const confirmed = window.confirm(
                    `${currentYear}년도 데이터를 삭제하시겠습니까?`,
                  );
                  if (!confirmed) return;
                  setData((prev) => ({
                    ...prev,
                    schedule: prev.schedule.filter(
                      (s) => Number(s.date.slice(0, 4)) !== currentYear,
                    ),
                  }));
                }}
              >
                연도 삭제
              </button>
            </>
          )}
        </div>
      </section>

      {data.schedule.length === 0 ? (
        <EmptyState
          onOpenDateModal={() => setDateModalOpen(true)}
          canEdit={entryState.isAdmin}
        />
      ) : (
        <>
          {visibleRows.length === 0 ? (
            <section className="empty card">
              <h2>표시할 일정이 없습니다</h2>
              <p>선택한 연도 또는 검색 조건에 맞는 결과가 없습니다.</p>
            </section>
          ) : (
            <ScheduleTable
              rows={visibleRows}
              swapSource={swapMode.source}
              searchQuery={searchQuery}
              onOpenWeekDetail={(weekKey) => setWeekDetailKey(weekKey)}
              onDutyClick={handleSwapClick}
              onUndoChange={undoChange}
            />
          )}
        </>
      )}

      <WeekDetailPanel
        isOpen={weekDetailKey !== null}
        weekLabel={weekDetailLabel}
        rows={weekDetailRows}
        onClose={() => setWeekDetailKey(null)}
      />

      <EditDateModal
        isOpen={isDateModalOpen}
        slots={data.schedule}
        currentYear={currentYear}
        onClose={() => setDateModalOpen(false)}
        onSave={saveSlots}
      />

      <EditRosterModal
        isOpen={isRosterModalOpen}
        teams={data.teams}
        rosters={data.rosters}
        onClose={() => setRosterModalOpen(false)}
        onSave={saveRosters}
      />

      <ConfirmCodeModal
        isOpen={isConfirmCodeModalOpen}
        expectedCode={YEAR_EXTEND_CONFIRM_CODE}
        onConfirm={handleConfirmExtendYear}
        onClose={() => setConfirmCodeModalOpen(false)}
      />

      <UsageGuideModal
        isOpen={isUsageGuideOpen}
        onClose={() => setUsageGuideOpen(false)}
      />
    </div>
  );
}
