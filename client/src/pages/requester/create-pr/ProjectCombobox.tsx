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

export default function ProjectCombobox({
  projects,
  selectedName,
  hasError,
  onSelect,
  onClear,
  onCreated,
  disabled,
}: Props) {
  const selected = projects.find((p) => p.name === selectedName);
  const options = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        label: p.name,
        subLabel: p.description || undefined,
      })),
    [projects]
  );

  return (
    <SearchCreateField
      options={options}
      displayValue={selected?.name || selectedName || ''}
      selectedId={selected?.id}
      placeholder="Search project name or description…"
      hasError={hasError}
      addNoun="project"
      emptyHint="No projects yet. Type a name to add one."
      createExtraPlaceholder="Project description (optional)"
      onSelect={(opt) => {
        const project = projects.find((p) => p.id === opt.id);
        if (project) onSelect(project);
      }}
      onClear={onClear}
      onCreate={
        disabled
          ? undefined
          : async (name, description) => {
              const res = await masterApi.chatCreateProject({ name, description });
              onCreated(res.data);
              onSelect(res.data);
            }
      }
    />
  );
}
