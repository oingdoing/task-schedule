interface HeaderProps {
  onOpenUsageGuide?: () => void;
}

export default function Header({ onOpenUsageGuide }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">University Duty Board</p>
        <h1>대학부 담당 일정표</h1>
      </div>
      {onOpenUsageGuide && (
        <button
          type="button"
          className="secondary header-usage-btn"
          onClick={onOpenUsageGuide}
        >
          사용 방법
        </button>
      )}
    </header>
  );
}
