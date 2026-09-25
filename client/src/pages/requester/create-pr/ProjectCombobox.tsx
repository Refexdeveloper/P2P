import { useMemo } from 'react';
import { ProjectRecord, masterApi } from '../../../services/api';
import SearchCreateField from './SearchCreateField';

interface Props {
  projects: ProjectRecord[];
  selectedName?: string;
  hasError?: boolean;
  onSelect: (project: ProjectRecord) => void;
  onClear: () => void;
  onCreated: (project: ProjectRecord) => void;
  disabled?: boolean;
}

function plantLabel(p: ProjectRecord) {
  return [p.code, p.name].filter(Boolean).join(' — ') || p.name;
}

export default function ProjectCombobox({
  projects,
  selectedName,
  hasError,
  onSelect,
  onClear,
  onCreated,
  disabled,
}: Props) {
  const selected = projects.find((p) => p.name === selectedName || p.code === selectedName);
  const options = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        label: plantLabel(p),
        subLabel: [p.billingLocation, p.siteAddress].filter(Boolean).join(' · ') || undefined,
      })),
    [projects]
  );

  return (
    <SearchCreateField
      options={options}
      displayValue={selected ? plantLabel(selected) : selectedName || ''}
      selectedId={selected?.id}
      placeholder="Search plant code or plant name…"
      hasError={hasError}
      addNoun="plant"
      emptyHint="No plants yet. Type a name to add one."
      createExtraPlaceholder="Plant code (optional)"
      onSelect={(opt) => {
        const project = projects.find((p) => p.id === opt.id);
        if (project) onSelect(project);
      }}
      onClear={onClear}
      onCreate={
        disabled
          ? undefined
          : async (name, extra) => {
              const res = await masterApi.chatCreateProject({
                name,
                code: extra || '',
              });
              onCreated(res.data);
              onSelect(res.data);
            }
      }
    />
  );
}
