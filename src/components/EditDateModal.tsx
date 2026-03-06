import { useCallback, useEffect, useState } from 'react';
import type { ScheduleSlot, ScheduleMemoType, SlotSelectableDuty } from '../types/schedule';
import {
  SCHEDULE_MEMO_TYPES,
  SCHEDULE_MEMO_TYPES_WITH_DETAIL,
} from '../types/schedule';
import {
  buildDefaultSlot,
  formatDateCell,
  normalizeSlotDutyEnabled,
  SLOT_SELECTABLE_DUTIES,
  sortSlots,
} from '../utils/rotation';

interface EditDateModalProps {
  isOpen: boolean;
  slots: ScheduleSlot[];
  currentYear: number;
  onClose: () => void;
  onSave: (slots: ScheduleSlot[]) => void;
}

export default function EditDateModal({
  isOpen,
  slots,
  currentYear,
  onClose,
  onSave,
}: EditDateModalProps) {
  const [draft, setDraft] = useState<ScheduleSlot[]>([]);
  const [newSlotIds, setNewSlotIds] = useState<Set<string>>(new Set());

  const addRow = useCallback(() => {
    const newSlot = buildDefaultSlot(new Date(currentYear, 0, 1));
    setDraft((prev) => [newSlot, ...prev]);
    setNewSlotIds((prev) => new Set(prev).add(newSlot.id));
  }, [currentYear]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const yearSlots = slots.filter((s) => Number(s.date.slice(0, 4)) === currentYear);
    setDraft(
      sortSlots(yearSlots).map((slot) => {
        const normalized = {
          ...slot,
          dutyEnabled: normalizeSlotDutyEnabled(slot.dutyEnabled),
        };
        if (!normalized.scheduleMemoType && normalized.noDutyMemo) {
          normalized.scheduleMemoType = '기타';
          normalized.scheduleMemoDetail = normalized.noDutyMemo;
        }
        return normalized;
      }),
    );
    setNewSlotIds(new Set());
  }, [isOpen, slots, currentYear]);

  if (!isOpen) {
    return null;
  }

  const updateRow = (id: string, patch: Partial<ScheduleSlot>) => {
    setDraft((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (next.hasDuty) {
          delete next.noDutyMemo;
        }
        return next;
      }),
    );
  };

  const removeRow = (slot: ScheduleSlot) => {
    const confirmed = window.confirm(
      `${slot.date ? formatDateCell(slot.date) : '해당'} 날짜를 삭제하시겠습니까?`,
    );
    if (!confirmed) return;
    setDraft((prev) => prev.filter((row) => row.id !== slot.id));
  };

  const toggleDutyEnabled = (id: string, duty: SlotSelectableDuty, checked: boolean) => {
    setDraft((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          dutyEnabled: {
            ...normalizeSlotDutyEnabled(row.dutyEnabled),
            [duty]: checked,
          },
        };
      }),
    );
  };

  const updateScheduleMemo = (
    id: string,
    type: ScheduleMemoType | '',
    detail: string,
  ) => {
    setDraft((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const prevType = row.scheduleMemoType;
        const next: ScheduleSlot = {
          ...row,
          scheduleMemoType: type || undefined,
          scheduleMemoDetail: detail || undefined,
        };
        if (type === '경배일') {
          next.dutyEnabled = {
            ...normalizeSlotDutyEnabled(row.dutyEnabled),
            설거지: false,
          };
        } else if (prevType === '경배일') {
          next.dutyEnabled = {
            ...normalizeSlotDutyEnabled(row.dutyEnabled),
            설거지: true,
          };
        }
        return next;
      }),
    );
  };

  const handleSave = () => {
    const valid = draft
      .filter((row) => row.date)
      .map((row) => ({
        ...row,
        dutyEnabled: normalizeSlotDutyEnabled(row.dutyEnabled),
      }));
    onSave(sortSlots(valid));
    window.alert('저장되었습니다!');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>날짜 수정 ({currentYear}년)</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>

        <div className="modal-body">
          {draft.length === 0 && (
            <p>등록된 슬롯이 없습니다. 아래에서 날짜를 추가해 주세요.</p>
          )}
          <div className="date-edit-table-wrap">
            <table className="date-edit-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>당번 유무</th>
                  <th>상세 항목</th>
                  <th>일정</th>
                  <th>편집</th>
                </tr>
              </thead>
              <tbody>
                {draft.map((slot) => {
                  const memoType = slot.scheduleMemoType ?? '';
                  const memoDetail = slot.scheduleMemoDetail ?? '';
                  const needsDetail = SCHEDULE_MEMO_TYPES_WITH_DETAIL.includes(
                    memoType as ScheduleMemoType,
                  );
                  return (
                    <tr
                      key={slot.id}
                      className={newSlotIds.has(slot.id) ? 'slot-row-new' : ''}
                    >
                      <td>
                        <input
                          type="date"
                          value={slot.date}
                          onChange={(e) => updateRow(slot.id, { date: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={slot.hasDuty ? 'yes' : 'no'}
                          onChange={(e) => {
                            const hasDuty = e.target.value === 'yes';
                            updateRow(slot.id, {
                              hasDuty,
                              ...(hasDuty
                                ? {}
                                : {
                                    noDutyMemo: slot.noDutyMemo ?? '',
                                    dutyEnabled: Object.fromEntries(
                                      SLOT_SELECTABLE_DUTIES.map((d) => [d, false]),
                                    ) as Record<SlotSelectableDuty, boolean>,
                                  }),
                            });
                          }}
                        >
                          <option value="yes">당번 있음</option>
                          <option value="no">당번 없음</option>
                        </select>
                      </td>
                      <td>
                        <details className="slot-duty-options">
                          <summary>당번 상세</summary>
                          <div className="slot-duty-checkboxes">
                            {SLOT_SELECTABLE_DUTIES.map((duty) => (
                              <label key={`${slot.id}-${duty}`}>
                                <input
                                  type="checkbox"
                                  checked={normalizeSlotDutyEnabled(slot.dutyEnabled)[duty]}
                                  disabled={!slot.hasDuty}
                                  onChange={(e) =>
                                    toggleDutyEnabled(slot.id, duty, e.target.checked)
                                  }
                                />
                                {duty}
                              </label>
                            ))}
                          </div>
                        </details>
                      </td>
                      <td>
                        <div className="schedule-memo-editor">
                          <select
                            value={memoType}
                            onChange={(e) => {
                              const v = e.target.value as ScheduleMemoType | '';
                              const keepDetail =
                                v && SCHEDULE_MEMO_TYPES_WITH_DETAIL.includes(v);
                              updateScheduleMemo(
                                slot.id,
                                v,
                                keepDetail ? memoDetail : '',
                              );
                            }}
                          >
                            <option value="">선택</option>
                            {SCHEDULE_MEMO_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="자세한 사항"
                            value={memoDetail}
                            disabled={!needsDetail}
                            onChange={(e) =>
                              updateScheduleMemo(slot.id, memoType as ScheduleMemoType, e.target.value)
                            }
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => removeRow(slot)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" className="secondary" onClick={addRow}>
            + 날짜 슬롯 추가
          </button>
        </div>

        <footer className="modal-footer">
          <button type="button" onClick={onClose} className="secondary">
            취소
          </button>
          <button type="button" onClick={handleSave}>
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}
