interface EmptyStateProps {
  onOpenDateModal: () => void;
  canEdit?: boolean;
}

export default function EmptyState({ onOpenDateModal, canEdit = false }: EmptyStateProps) {
  return (
    <section className="empty card">
      <h2>등록된 일정이 없습니다</h2>
      {canEdit ? (
        <>
          <p>먼저 [날짜 수정]에서 당번 날짜를 추가해 주세요.</p>
          <button type="button" onClick={onOpenDateModal}>
            날짜 추가 시작
          </button>
        </>
      ) : (
        <p>관리자에게 문의하세요.</p>
      )}
    </section>
  );
}
