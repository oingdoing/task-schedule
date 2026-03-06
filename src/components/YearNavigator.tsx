interface YearNavigatorProps {
  year: number;
  disablePrevYear?: boolean;
  onPrevYear: () => void;
  onNextYear: () => void;
}

export default function YearNavigator({
  year,
  disablePrevYear = false,
  onPrevYear,
  onNextYear,
}: YearNavigatorProps) {
  return (
    <div className="year-nav card">
      <button type="button" onClick={onPrevYear} disabled={disablePrevYear}>
        ← 이전 연도
      </button>
      <strong>{year}년</strong>
      <button type="button" onClick={onNextYear}>
        다음 연도 →
      </button>
    </div>
  );
}
