import type { RosterCategory } from '../types/schedule';

interface RosterEditorProps {
  category: RosterCategory;
  title: string;
  members: string[];
  onChange: (category: RosterCategory, members: string[]) => void;
}

export default function RosterEditor({ category, title, members, onChange }: RosterEditorProps) {
  const draftMembers = members.length > 0 ? members : [''];

  const updateMember = (index: number, value: string) => {
    const next = [...draftMembers];
    next[index] = value;
    onChange(category, next);
  };

  return (
    <section className="team-editor roster-editor">
      <h3>{title}</h3>
      <div className="team-grid-wrap">
        <table className="team-grid roster-grid">
          <thead>
            <tr>
              <th>순번</th>
              <th>담당자</th>
            </tr>
          </thead>
          <tbody>
            {draftMembers.map((member, index) => (
              <tr key={`${category}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  <input
                    type="text"
                    value={member}
                    onChange={(event) => updateMember(index, event.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <small>{members.filter((member) => member.trim().length > 0).length}명</small>
      </div>
    </section>
  );
}
