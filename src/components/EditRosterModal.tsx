import { useEffect, useState } from 'react';
import type { RosterCategory, Rosters, Teams } from '../types/schedule';
import RosterEditor from './RosterEditor';
import TeamSelectWithRoster from './TeamSelectWithRoster';

interface EditRosterModalProps {
  isOpen: boolean;
  teams: Teams;
  rosters: Rosters;
  onClose: () => void;
  onSave: (payload: { teams: Teams; rosters: Rosters }) => void;
}

function cloneTeams(teams: Teams): Teams {
  return {
    설거지: Object.fromEntries(
      Object.entries(teams.설거지).map(([teamName, members]) => [teamName, [...members]]),
    ),
    화장실청소: Object.fromEntries(
      Object.entries(teams.화장실청소).map(([teamName, members]) => [teamName, [...members]]),
    ),
  };
}

function cloneRosters(rosters: Rosters): Rosters {
  return {
    피청커청건청: [...rosters.피청커청건청],
    간식: [...rosters.간식],
    본교팀장주중: [...rosters.본교팀장주중],
    본교팀장주말: [...rosters.본교팀장주말],
  };
}

function normalizeRosterMembers(members: string[]): string[] {
  return members.map((member) => member.trim()).filter(Boolean);
}

function normalizeRosters(rosters: Rosters): Rosters {
  return {
    피청커청건청: normalizeRosterMembers(rosters.피청커청건청),
    간식: normalizeRosterMembers(rosters.간식),
    본교팀장주중: normalizeRosterMembers(rosters.본교팀장주중),
    본교팀장주말: normalizeRosterMembers(rosters.본교팀장주말),
  };
}

export default function EditRosterModal({
  isOpen,
  teams,
  rosters,
  onClose,
  onSave,
}: EditRosterModalProps) {
  const [draftTeams, setDraftTeams] = useState<Teams>(cloneTeams(teams));
  const [draftRosters, setDraftRosters] = useState<Rosters>(cloneRosters(rosters));

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraftTeams(cloneTeams(teams));
    setDraftRosters(cloneRosters(rosters));
  }, [isOpen, teams, rosters]);

  if (!isOpen) {
    return null;
  }

  const updateRoster = (category: RosterCategory, members: string[]) => {
    setDraftRosters((prev) => ({ ...prev, [category]: members }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card wide" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>명단 수정</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>

        <div className="modal-body roster-layout">
          <div className="roster-column">
            <RosterEditor
              category="피청커청건청"
              title="피청/커청/건청"
              members={draftRosters.피청커청건청}
              onChange={updateRoster}
            />
            <RosterEditor
              category="간식"
              title="간식"
              members={draftRosters.간식}
              onChange={updateRoster}
            />
            <RosterEditor
              category="본교팀장주중"
              title="본교팀장 주중"
              members={draftRosters.본교팀장주중}
              onChange={updateRoster}
            />
            <RosterEditor
              category="본교팀장주말"
              title="본교팀장 주말"
              members={draftRosters.본교팀장주말}
              onChange={updateRoster}
            />
          </div>

          <div className="roster-column">
            <TeamSelectWithRoster
              title="설거지"
              teams={draftTeams.설거지}
              fixedCount={3}
              onChange={(next) => setDraftTeams((prev) => ({ ...prev, 설거지: next }))}
            />
            <TeamSelectWithRoster
              title="화장실청소"
              teams={draftTeams.화장실청소}
              fixedCount={2}
              onChange={(next) => setDraftTeams((prev) => ({ ...prev, 화장실청소: next }))}
            />
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ teams: draftTeams, rosters: normalizeRosters(draftRosters) });
              onClose();
            }}
          >
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}
