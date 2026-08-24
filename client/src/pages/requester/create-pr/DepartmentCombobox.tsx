import { useMemo } from 'react';
import { DepartmentRecord, masterApi } from '../../../services/api';
import SearchCreateField from './SearchCreateField';

interface Props {
  departments: DepartmentRecord[];
  selectedName?: string;
  hasError?: boolean;
  onSelect: (department: DepartmentRecord) => void;
  onClear: () => void;
  onCreated: (department: DepartmentRecord) => void;
}

export default function DepartmentCombobox({
  departments,
  selectedName,
  hasError,
  onSelect,
  onClear,
  onCreated,
}: Props) {
  const selected = departments.find((d) => d.name === selectedName);
  const options = useMemo(
    () =>
      departments.map((d) => ({
        id: d.id,
        label: d.name,
        subLabel: d.code || undefined,
      })),
    [departments]
  );

  return (
    <SearchCreateField
      options={options}
      displayValue={selected ? selected.name : selectedName || ''}
      selectedId={selected?.id}
      placeholder="Search department by name or code…"
      hasError={hasError}
      addNoun="department"
      onSelect={(opt) => {
        const dept = departments.find((d) => d.id === opt.id);
        if (dept) onSelect(dept);
      }}
      onClear={onClear}
      onCreate={async (name) => {
        const res = await masterApi.chatCreateDepartment({ name });
        onCreated(res.data);
        onSelect(res.data);
      }}
    />
  );
}
