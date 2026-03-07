import type { Rosters, Teams } from '../types/schedule';

interface ViewRosterModalProps {
  isOpen: boolean;
  teams: Teams;
  rosters: Rosters;
  onClose: () => void;
}

const ROSTER_LABELS: Record<keyof Rosters, string> = {
  피청커청건청: '피청/커청/건청',
  간식: '간식',
  본교팀장주중: '본교팀장 주중',
  본교팀장주말: '본교팀장 주말',
};

export default function ViewRosterModal({
  isOpen,
  teams,
  rosters,
  onClose,
}: ViewRosterModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>명단 보기</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>

        <div className="modal-body view-roster-body">
          <div className="view-roster-section">
            <h3>담당별 명단</h3>
            <table className="view-roster-table">
              <thead>
                <tr>
                  <th>담당</th>
                  <th>명단</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(rosters) as (keyof Rosters)[]).map((key) => (
                  <tr key={key}>
                    <td>{ROSTER_LABELS[key]}</td>
                    <td>{rosters[key].length ? rosters[key].join(', ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="view-roster-section">
            <h3>설거지</h3>
            <table className="view-roster-table">
              <thead>
                <tr>
                  <th>팀</th>
                  <th>멤버</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(teams.설거지).map(([teamName, members]) => (
                  <tr key={teamName}>
                    <td>{teamName}</td>
                    <td>{members.length ? members.join(', ') : '-'}</td>
                  </tr>
                ))}
                {Object.keys(teams.설거지).length === 0 && (
                  <tr>
                    <td colSpan={2}>등록된 팀이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="view-roster-section">
            <h3>화장실청소</h3>
            <table className="view-roster-table">
              <thead>
                <tr>
                  <th>팀</th>
                  <th>멤버</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(teams.화장실청소).map(([teamName, members]) => (
                  <tr key={teamName}>
                    <td>{teamName}</td>
                    <td>{members.length ? members.join(', ') : '-'}</td>
                  </tr>
                ))}
                {Object.keys(teams.화장실청소).length === 0 && (
                  <tr>
                    <td colSpan={2}>등록된 팀이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
