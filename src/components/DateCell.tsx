import { useRef, useState, useCallback } from 'react';
import type { ScheduleSlot } from '../types/schedule';
import type { ScheduleMemoType } from '../types/schedule';
import {
  formatDateCell,
  getScheduleMemoDisplay,
  isKoreanPublicHoliday,
  isWeekend,
} from '../utils/rotation';

interface DateCellProps {
  slot: ScheduleSlot;
}

const SCHEDULE_MEMO_POPUP_DURATION_MS = 3000;

export default function DateCell({ slot }: DateCellProps) {
  const [showPopup, setShowPopup] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memoDisplay = getScheduleMemoDisplay(slot);
  const memoType = slot.scheduleMemoType as ScheduleMemoType | undefined;
  const hasMemo = !!memoDisplay;
  const popupContent = !slot.hasDuty
    ? hasMemo
      ? `당번 없음 (${memoDisplay})`
      : '당번 없음'
    : memoDisplay;

  const isGiryeong = memoType === '기령일';
  const isHolidayType = memoType === '공휴일' || memoType === '연휴';
  const isWeekendOrHoliday =
    isWeekend(slot.date) || isKoreanPublicHoliday(slot.date);
  const giryeongHighlight = isGiryeong && isWeekendOrHoliday;

  const handleMouseEnter = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (hasMemo || !slot.hasDuty) {
      setShowPopup(true);
      hideTimerRef.current = setTimeout(() => {
        setShowPopup(false);
        hideTimerRef.current = null;
      }, SCHEDULE_MEMO_POPUP_DURATION_MS);
    }
  }, [hasMemo, slot.hasDuty]);

  const handleMouseLeave = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShowPopup(false);
  }, []);

  const tdClasses = [
    'date-cell-td',
    memoType ? 'date-schedule-has-type' : '',
    isGiryeong ? 'date-schedule-giryeong' : '',
    giryeongHighlight ? 'date-schedule-giryeong-highlight' : '',
    isHolidayType ? 'date-schedule-holiday' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td
      className={tdClasses}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="date-cell-inner">
        <span>{formatDateCell(slot.date)}</span>
        {(hasMemo || !slot.hasDuty) && showPopup && (
          <div className="date-memo-popup" role="tooltip">
            {popupContent}
          </div>
        )}
      </div>
    </td>
  );
}
