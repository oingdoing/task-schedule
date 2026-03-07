import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import Header from './components/Header';
import YearNavigator from './components/YearNavigator';
import ScheduleTable from './components/ScheduleTable';
import WeekDetailPanel from './components/WeekDetailPanel';
import EmptyState from './components/EmptyState';
import EditDateModal from './components/EditDateModal';
import EditRosterModal from './components/EditRosterModal';
import SubstituteModal from './components/SubstituteModal';
import ConfirmCodeModal from './components/ConfirmCodeModal';
import EntryGate from './components/EntryGate';
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
  migrateChangeLogForDateEdit,
  normalizeSlotDutyEnabled,
  sortSlots,
  toISODate,
} from './utils/rotation';
import { ensureAnonymousSession, supabase } from './lib/supabase';

const YEAR_EXTEND_CONFIRM_CODE = '생성확인';
const DEFAULT_START_YEAR = 2026;
const DEFAULT_WEEKDAYS = [3, 6, 0];
const CUSTOM_2026_START_DATE = '2026-02-25';
const CUSTOM_2026_DUPLICATE_SATURDAY = '2026-02-28';
const DOCUMENT_ID = 'default';
const EDIT_LOCK_REFRESH_MS = 60_000;
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

async function loadDataFromSupabase(): Promise<ScheduleData> {
  if (typeof window === 'undefined') return baseData();

  try {
    const { data: row, error } = await supabase
      .from('schedule_data')
      .select('data, version')
      .eq('document_id', DOCUMENT_ID)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return baseData();
      console.warn('Supabase load error:', error);
      return baseData();
    }

    if (!row?.data) return baseData();

    const parsed = row.data as Partial<ScheduleData>;
    const fallback = baseData();
    const savedSchedule = Array.isArray(parsed.schedule)
      ? normalizeScheduleSlots(parsed.schedule as ScheduleSlot[])
      : fallback.schedule;
    const merged: ScheduleData = {
      teams: parsed.teams ?? fallback.teams,
      rosters: parsed.rosters ?? fallback.rosters,
      schedule: savedSchedule,
      changeLog: parsed.changeLog ?? fallback.changeLog,
    };

    if (merged.schedule.length > 0) return merged;
    return { ...merged, schedule: buildDefaultSchedule() };
  } catch {
    return baseData();
  }
}

async function saveDataToSupabase(data: ScheduleData): Promise<void> {
  const { error } = await supabase.from('schedule_data').upsert(
    {
      document_id: DOCUMENT_ID,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'document_id' },
  );
  if (error) {
    console.error('Supabase save error:', error);
    throw error;
  }
}

async function acquireEditLock(): Promise<boolean> {
  const { error } = await supabase.rpc('acquire_edit_lock', {
    p_document_id: DOCUMENT_ID,
  });
  return !error;
}

async function refreshEditLock(): Promise<void> {
  const { error } = await supabase.rpc('refresh_edit_lock', {
    p_document_id: DOCUMENT_ID,
  });
  if (error) throw error;
}

async function releaseEditLock(): Promise<void> {
  await supabase.rpc('release_edit_lock', { p_document_id: DOCUMENT_ID });
}

function getInitialYear(data: ScheduleData): number {
  if (data.schedule.length === 0) return new Date().getFullYear();
  const years = data.schedule.map((slot) => Number(slot.date.slice(0, 4)));
  return Math.min(...years);
}

function formatMonthDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function buildChangeSummary(log: ChangeLogEntry): string {
  if (log.isSubstitute) {
    return `${formatMonthDay(log.cellA.date)} ${log.cellA.person} ➡ ${log.cellB.person} 변경`;
  }
  return `${formatMonthDay(log.cellB.date)} ${log.cellB.person} ↔ ${formatMonthDay(log.cellA.date)} ${log.cellA.person}`;
}

type AccessRole = 'editor' | 'admin';

export default function App() {
  const [accessState, setAccessState] = useState<{ role: AccessRole } | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [isAdminCodeModalOpen, setAdminCodeModalOpen] = useState(false);
  const [data, setData] = useState<ScheduleData>(() => baseData());
  const [currentYear, setCurrentYear] = useState<number>(() => getInitialYear(baseData()));
  const [searchQuery, setSearchQuery] = useState('');
  const [weekDetailKey, setWeekDetailKey] = useState<string | null>(null);
  const [isDateModalOpen, setDateModalOpen] = useState(false);
  const [isRosterModalOpen, setRosterModalOpen] = useState(false);
  const [isConfirmCodeModalOpen, setConfirmCodeModalOpen] = useState(false);
  const [isSubstituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [isUsageGuideOpen, setUsageGuideOpen] = useState(false);
  const [hasEditLock, setHasEditLock] = useState(false);
  const hasEditLockRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const swapMode = useSwapMode();

  const isAdmin = accessState?.role === 'admin';
  const canEdit = accessState?.role === 'editor' || accessState?.role === 'admin';

  useEffect(() => {
    ensureAnonymousSession().catch((e) => {
      console.error('anonymous session error:', e);
      setEntryError('초기 인증에 실패했습니다. 새로고침 후 다시 시도해 주세요.');
    });
  }, []);

  const handleGrantAccess = useCallback(async (code: string) => {
    setEntryError(null);

    await ensureAnonymousSession();

    const { data: result, error } = await supabase.rpc('grant_document_access', {
      p_document_id: DOCUMENT_ID,
      p_code: code.trim(),
    });

    if (error) {
      const msg = error.message ?? '코드가 일치하지 않습니다.';
      setEntryError(msg);
      throw new Error(msg);
    }

    const role = (
      typeof result === 'object' && result !== null && 'role' in result
        ? (result as { role: string }).role
        : result
    ) as AccessRole;
    if (role !== 'editor' && role !== 'admin') {
      const msg = '접근 권한을 확인할 수 없습니다.';
      setEntryError(msg);
      throw new Error(msg);
    }

    setAccessState({ role });
    const loaded = await loadDataFromSupabase();
    setData(loaded);
    setCurrentYear(getInitialYear(loaded));
    setEntryError(null);
  }, []);

  const doReleaseLock = useCallback(async () => {
    if (!hasEditLockRef.current) return;
    try {
      await releaseEditLock();
    } catch (e) {
      console.warn('release_edit_lock error:', e);
    } finally {
      hasEditLockRef.current = false;
      setHasEditLock(false);
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasEditLockRef.current) {
        releaseEditLock().catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (hasEditLockRef.current) {
        releaseEditLock().catch(() => {});
      }
    };
  }, []);

  /** 다른 탭에서 저장 시 최신 데이터로 동기화 (여러 탭 덮어쓰기 방지) */
  useEffect(() => {
    if (!hasEditLock || !canEdit) return;
    const interval = setInterval(() => {
      refreshEditLock().catch(() => {});
    }, EDIT_LOCK_REFRESH_MS);
    return () => clearInterval(interval);
  }, [hasEditLock, canEdit]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('duty-schedule-sync');
    syncChannelRef.current = channel;

    const handleMessage = () => {
      skipNextSaveRef.current = true;
      loadDataFromSupabase().then((loaded) => {
        setData(loaded);
        setCurrentYear(getInitialYear(loaded));
      });
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      syncChannelRef.current = null;
    };
  }, []);

  const tryAcquireAndRun = useCallback(
    async (fn: () => void | Promise<void>) => {
      if (!canEdit) return;
      const ok = await acquireEditLock();
      if (!ok) {
        window.alert('다른 사용자가 편집 중입니다.');
        return;
      }
      hasEditLockRef.current = true;
      setHasEditLock(true);
      await fn();
    },
    [canEdit],
  );

  const handleOpenDateModal = useCallback(() => {
    tryAcquireAndRun(() => setDateModalOpen(true));
  }, [tryAcquireAndRun]);

  const handleCloseDateModal = useCallback(() => {
    doReleaseLock();
    setDateModalOpen(false);
  }, [doReleaseLock]);

  const handleOpenRosterModal = useCallback(() => {
    tryAcquireAndRun(() => setRosterModalOpen(true));
  }, [tryAcquireAndRun]);

  const handleCloseRosterModal = useCallback(() => {
    doReleaseLock();
    setRosterModalOpen(false);
  }, [doReleaseLock]);

  const handleCancelSwap = useCallback(() => {
    doReleaseLock();
    swapMode.reset();
  }, [doReleaseLock, swapMode]);

  const handleOpenSubstituteModal = useCallback(() => {
    if (swapMode.source) setSubstituteModalOpen(true);
  }, [swapMode.source]);

  const handleCloseSubstituteModal = useCallback(() => {
    setSubstituteModalOpen(false);
  }, []);

  const handleSaveSubstitute = useCallback(
    (substituteName: string) => {
      const source = swapMode.source;
      if (!source) return;

      const entry: ChangeLogEntry = {
        id: makeId('log'),
        date: toISODate(new Date()),
        dutyType: source.dutyType,
        cellA: { slotId: source.slotId, date: source.date, person: source.person },
        cellB: { slotId: source.slotId, date: source.date, person: substituteName },
        isSubstitute: true,
      };
      setData((prev: ScheduleData) => ({ ...prev, changeLog: [...prev.changeLog, entry] }));
      swapMode.reset();
      setSubstituteModalOpen(false);
    },
    [swapMode],
  );

  const isFirstDataEffect = useRef(true);
  useEffect(() => {
    if (!canEdit) return;
    if (isFirstDataEffect.current) {
      isFirstDataEffect.current = false;
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await saveDataToSupabase(data);
        // DB 커밋 후 다른 탭이 최신 데이터를 읽을 수 있도록 짧은 지연 후 broadcast
        setTimeout(() => {
          syncChannelRef.current?.postMessage({ type: 'data-saved' });
        }, 100);
      } catch (e: unknown) {
        console.error('Save error:', e);
      } finally {
        if (hasEditLockRef.current) {
          doReleaseLock().catch((e) => console.warn('release_edit_lock error:', e));
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [data, canEdit, doReleaseLock]);

  const hasDataForYear = (year: number) =>
    data.schedule.some((slot: ScheduleSlot) => Number(slot.date.slice(0, 4)) === year);

  const handleNextYear = () => {
    const nextY = currentYear + 1;
    if (hasDataForYear(nextY)) {
      setCurrentYear(nextY);
      return;
    }
    if (!isAdmin) {
      window.alert('다음 연도 데이터 생성은 관리자만 가능합니다.');
      return;
    }
    const ok = window.confirm('다음 연도의 데이터를 생성하시겠습니까?');
    if (!ok) return;
    setConfirmCodeModalOpen(true);
  };

  const handleConfirmExtendYear = async () => {
    setConfirmCodeModalOpen(false);
    const nextY = currentYear + 1;
    const ok = await acquireEditLock();
    if (!ok) {
      window.alert('다른 사용자가 편집 중입니다.');
      return;
    }
    hasEditLockRef.current = true;
    setHasEditLock(true);
    const currentSlots = data.schedule.filter((s: ScheduleSlot) => Number(s.date.slice(0, 4)) <= currentYear);
    const extended = buildNextYearSlots(currentSlots, nextY, DEFAULT_WEEKDAYS);
    setData((prev: ScheduleData) => ({ ...prev, schedule: normalizeScheduleSlots(extended) }));
    setCurrentYear(nextY);
    window.alert(`${nextY}년 데이터가 생성되었습니다.`);
  };

  const allRows = useMemo(() => computeAssignmentRows(data), [data]);

  const yearRows = useMemo(
    () => allRows.filter((row: AssignmentRow) => Number(row.slot.date.slice(0, 4)) === currentYear),
    [allRows, currentYear],
  );

  const visibleRows = useMemo(
    () => yearRows.filter((row: AssignmentRow) => matchesSearch(row, searchQuery)),
    [yearRows, searchQuery],
  );

  const weekDetailRows = useMemo(() => {
    if (!weekDetailKey) return [];
    return yearRows.filter((row: AssignmentRow) => row.weekKey === weekDetailKey);
  }, [yearRows, weekDetailKey]);

  const weekDetailLabel = useMemo(() => weekDetailRows[0]?.weekLabel ?? null, [weekDetailRows]);

  useEffect(() => {
    if (!weekDetailKey) return;
    if (!yearRows.some((row: AssignmentRow) => row.weekKey === weekDetailKey)) {
      setWeekDetailKey(null);
    }
  }, [weekDetailKey, yearRows]);

  const handleSwapClick = useCallback(
    (row: AssignmentRow, dutyType: SwapDutyType, targetPerson?: string) => {
      if (!canEdit) return;

      const person = targetPerson ?? row.assignments[dutyType];
      const target = {
        slotId: row.slot.id,
        date: row.slot.date,
        dutyType,
        person,
      };

      if (!swapMode.source) {
        const tryStartSwap = async () => {
          const ok = await acquireEditLock();
          if (!ok) {
            window.alert('다른 사용자가 편집 중입니다.');
            return;
          }
          hasEditLockRef.current = true;
          setHasEditLock(true);
          const confirmed = window.confirm('담당자를 바꾸시겠습니까?');
          if (!confirmed) {
            await doReleaseLock();
            return;
          }
          swapMode.selectSource(target);
        };
        tryStartSwap();
        return;
      }

      const source = swapMode.source;
      if (source.slotId === target.slotId && source.dutyType === target.dutyType) {
        handleCancelSwap();
        return;
      }
      if (source.dutyType !== target.dutyType) {
        window.alert('같은 업무 항목끼리만 교환할 수 있습니다.');
        return;
      }
      const confirmed = window.confirm(
        `${formatDateWithWeekday(source.date)} ${source.person} ↔ ${formatDateWithWeekday(target.date)} ${target.person}\n이 사람과 바꾸시겠습니까?`,
      );
      if (!confirmed) return;

      const entry: ChangeLogEntry = {
        id: makeId('log'),
        date: toISODate(new Date()),
        dutyType: source.dutyType,
        cellA: { slotId: source.slotId, date: source.date, person: source.person },
        cellB: { slotId: target.slotId, date: target.date, person: target.person },
      };
      setData((prev: ScheduleData) => ({ ...prev, changeLog: [...prev.changeLog, entry] }));
      swapMode.reset();
    },
    [canEdit, swapMode, doReleaseLock, handleCancelSwap],
  );

  const saveSlots = (slots: ScheduleSlot[]) => {
    setData((prev: ScheduleData) => {
      const oldYearSlots = prev.schedule.filter(
        (s: ScheduleSlot) => Number(s.date.slice(0, 4)) === currentYear,
      );
      const otherYears = prev.schedule.filter(
        (s: ScheduleSlot) => Number(s.date.slice(0, 4)) !== currentYear,
      );
      const merged = [...otherYears, ...slots];
      const migratedLog = migrateChangeLogForDateEdit(
        oldYearSlots,
        slots,
        prev.changeLog,
      );
      return {
        ...prev,
        schedule: normalizeScheduleSlots(merged),
        changeLog: migratedLog,
      };
    });
  };

  const saveRosters = (payload: { teams: Teams; rosters: Rosters }) => {
    setData((prev: ScheduleData) => ({
      ...prev,
      teams: normalizeTeams(payload.teams),
      rosters: normalizeRosters(payload.rosters),
    }));
  };

  const undoChange = (id: string) => {
    if (!canEdit) return;
    const index = data.changeLog.findIndex((log: ChangeLogEntry) => log.id === id);
    if (index < 0) return;

    const target = data.changeLog[index];
    const confirmed = window.confirm(`${buildChangeSummary(target)}\n이 변경 내역을 취소하시겠습니까?`);
    if (!confirmed) return;

    tryAcquireAndRun(async () => {
      const newData: ScheduleData = {
        ...data,
        changeLog: data.changeLog.slice(0, index),
      };
      setData(newData);
      skipNextSaveRef.current = true;
      try {
        await saveDataToSupabase(newData);
        // 저장 직후 broadcast (doReleaseLock 실패해도 broadcast는 실행됨)
        setTimeout(() => {
          syncChannelRef.current?.postMessage({ type: 'data-saved' });
        }, 100);
      } catch (e: unknown) {
        console.error('Save error:', e);
      } finally {
        if (hasEditLockRef.current) {
          doReleaseLock().catch((e) => console.warn('release_edit_lock error:', e));
        }
      }
    });
  };

  useEffect(() => {
    if (!accessState) return;

    const channel = supabase
      .channel(`schedule-data-${DOCUMENT_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_data',
          filter: `document_id=eq.${DOCUMENT_ID}`,
        },
        (payload: { new?: unknown }) => {
          if (hasEditLockRef.current) return;
          if (!payload.new || typeof payload.new !== 'object') return;

          const row = payload.new as {
            data?: Partial<ScheduleData>;
          };

          const nextData = row.data;
          if (!nextData) return;

          const fallback = baseData();
          const savedSchedule = Array.isArray(nextData.schedule)
            ? normalizeScheduleSlots(nextData.schedule as ScheduleSlot[])
            : fallback.schedule;

          const merged: ScheduleData = {
            teams: nextData.teams ?? fallback.teams,
            rosters: nextData.rosters ?? fallback.rosters,
            schedule: savedSchedule,
            changeLog: nextData.changeLog ?? fallback.changeLog,
          };

          skipNextSaveRef.current = true;
          setData(merged);
          setCurrentYear((prev: number) => {
            const hasYear = merged.schedule.some(
              (slot: ScheduleSlot) => Number(slot.date.slice(0, 4)) === prev,
            );
            return hasYear ? prev : getInitialYear(merged);
          });
          syncChannelRef.current?.postMessage({ type: 'data-saved' });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accessState]);

  if (!accessState) {
    return (
      <div className="app-shell">
        <Header onOpenUsageGuide={() => setUsageGuideOpen(true)} />
        <EntryGate
          onCodeSubmit={handleGrantAccess}
          error={entryError}
          onOpenAdminModal={() => setAdminCodeModalOpen(true)}
        />
        <AdminCodeModal
          isOpen={isAdminCodeModalOpen}
          onCodeSubmit={handleGrantAccess}
          onClose={() => setAdminCodeModalOpen(false)}
        />
        <UsageGuideModal isOpen={isUsageGuideOpen} onClose={() => setUsageGuideOpen(false)} />
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
          {swapMode.source && canEdit && (
            <>
              <button type="button" className="secondary" onClick={handleCancelSwap}>
                변경 취소
              </button>
              <button type="button" className="secondary" onClick={handleOpenSubstituteModal}>
                대신하기
              </button>
            </>
          )}
          {isAdmin && (
            <>
              <button type="button" onClick={handleOpenDateModal}>
                날짜 수정
              </button>
              <button type="button" onClick={handleOpenRosterModal}>
                명단 수정
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                    const confirmed = window.confirm(`${currentYear}년도 데이터를 삭제하시겠습니까?`);
                    if (!confirmed) return;
                    tryAcquireAndRun(() => {
                      setData((prev) => ({
                        ...prev,
                        schedule: prev.schedule.filter(
                          (s) => Number(s.date.slice(0, 4)) !== currentYear,
                        ),
                      }));
                    });
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
          onOpenDateModal={handleOpenDateModal}
          canEdit={isAdmin}
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
              swapSource={canEdit ? swapMode.source : null}
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
        onClose={handleCloseDateModal}
        onSave={saveSlots}
      />

      <EditRosterModal
        isOpen={isRosterModalOpen}
        teams={data.teams}
        rosters={data.rosters}
        onClose={handleCloseRosterModal}
        onSave={saveRosters}
      />

      <SubstituteModal
        isOpen={isSubstituteModalOpen}
        originalPerson={swapMode.source?.person ?? ''}
        slotDate={swapMode.source?.date ?? ''}
        dutyType={swapMode.source?.dutyType ?? '피청'}
        onSave={handleSaveSubstitute}
        onClose={handleCloseSubstituteModal}
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
