import { useMemo } from 'react';

interface TeamSelectWithRosterProps {
  title: string;
  teams: Record<string, string[]>;
  onChange: (teams: Record<string, string[]>) => void;
  fixedCount?: number;
}

function sortTeamNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const aNo = Number.parseInt(a, 10);
    const bNo = Number.parseInt(b, 10);
    if (Number.isNaN(aNo) || Number.isNaN(bNo)) {
      return a.localeCompare(b, 'ko');
    }
    return aNo - bNo;
  });
}

function normalizeMembers(members: string[], fixedCount?: number): string[] {
  if (!fixedCount) {
    return members;
  }
  const next = members.slice(0, fixedCount);
  while (next.length < fixedCount) {
    next.push('');
  }
  return next;
}

export default function TeamSelectWithRoster({ title, teams, onChange }: TeamSelectWithRosterProps) {
  const teamNames = useMemo(() => sortTeamNames(Object.keys(teams)), [teams]);

  const updateTeamMembers = (teamName: string, members: string[]) => {
    onChange({
      ...teams,
      [teamName]: members,
    });
  };

  return (
    <section className="team-editor">
      <h3>{title}</h3>
      {teamNames.length === 0 ? (
        <p>팀 정보가 없습니다.</p>
      ) : (
        <div className="team-grid-wrap">
          <table className="team-grid">
            <thead>
              <tr>
                <th>팀</th>
                <th>팀원</th>
              </tr>
            </thead>
            <tbody>
              {teamNames.map((teamName) => {
                const members = normalizeMembers(teams[teamName] ?? []);
                return (
                  <tr key={teamName}>
                    <td>
                      <span className="team-name-pill">{teamName}</span>
                    </td>
                    <td>
                      <div className="team-members-inline">
                        {members.map((member, memberIndex) => (
                          <input
                            key={`${teamName}-${memberIndex}`}
                            type="text"
                            value={member}
                            onChange={(event) => {
                              const next = [...members];
                              next[memberIndex] = event.target.value;
                              updateTeamMembers(teamName, next);
                            }}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
