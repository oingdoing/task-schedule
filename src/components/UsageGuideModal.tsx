interface UsageGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const USAGE_SECTIONS = [
  {
    title: '1. 일정 확인',
    content:
      '특정 표시가 있는 날짜에 마우스를 올리면 내용을 볼 수 있습니다.',
  },
  {
    title: '2. 담당 변경',
    content:
      '담당자를 변경하려면, 바꾸려는 사람의 이름(A)을 클릭하면 "담당자를 바꾸시겠습니까?" 창이 뜨고, 확인을 누르면 바꿀 수 있습니다. A의 이름이 활성화되어 있는 상태에서 원하는 날짜의 원하는 사람 이름을 클릭하면 담당자가 바뀝니다. 이미 바꾼 담당자를 또 바꾸고 싶으면 같은 작업을 반복합니다.',
  },
  {
    title: '3. 변경 취소',
    content:
      '담당자를 바꾸면 바꾼 사람 이름은 굵게 표시되고, 우측에 내용을 볼 수 있는 작은 점이 생깁니다. 해당 점을 클릭하면 내용을 볼 수 있고, 변경 취소도 가능합니다. 취소할 때는 해당하는 내용에 "변경 취소" 버튼을 누릅니다.',
  },
  {
    title: '4. 주 담당',
    content:
      "주 담당 칸의 '보기' 버튼을 누르면 해당 주의 담당을 모아서 볼 수 있습니다.",
  },
  {
    title: '5. 담당자 검색',
    content:
      '확인하고 싶은 이름을 검색하면, 검색한 이름이 포함된 담당을 모아서 보여줍니다.',
  },
];

export default function UsageGuideModal({ isOpen, onClose }: UsageGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card usage-guide-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>사용 방법</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="modal-body usage-guide-body">
          {USAGE_SECTIONS.map((section) => (
            <section key={section.title} className="usage-guide-section">
              <h3>{section.title}</h3>
              <p>{section.content}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
