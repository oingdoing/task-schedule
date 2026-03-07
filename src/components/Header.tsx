interface HeaderProps {
  onOpenUsageGuide?: () => void;
  onOpenViewRoster?: () => void;
}

export default function Header({ onOpenUsageGuide, onOpenViewRoster }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">University Duty Board</p>
        <h1>대학부 담당 일정표</h1>
      </div>
      {(onOpenViewRoster || onOpenUsageGuide) && (
        <div className="header-buttons">
          {onOpenViewRoster && (
            <button
              type="button"
              className="secondary header-usage-btn"
              onClick={onOpenViewRoster}
            >
              명단 보기
            </button>
          )}
          {onOpenUsageGuide && (
            <button
              type="button"
              className="secondary header-usage-btn"
              onClick={onOpenUsageGuide}
            >
              사용 방법
            </button>
          )}
        </div>
      )}
    </header>
  );
}
