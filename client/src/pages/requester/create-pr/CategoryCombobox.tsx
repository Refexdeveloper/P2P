import { useMemo } from 'react';
import { CategoryRecord, masterApi } from '../../../services/api';
import SearchCreateField from './SearchCreateField';

interface Props {
  categories: CategoryRecord[];
  selectedName?: string;
  hasError?: boolean;
  requestType?: string;
  onSelect: (category: CategoryRecord) => void;
  onClear: () => void;
  onCreated: (category: CategoryRecord) => void;
}

export default function CategoryCombobox({
  categories,
  selectedName,
  hasError,
  requestType,
  onSelect,
  onClear,
  onCreated,
}: Props) {
  const selected = categories.find((c) => c.name === selectedName);
  const options = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: c.name,
        subLabel: c.requestType && c.requestType !== 'All' ? c.requestType : undefined,
      })),
    [categories]
  );

  return (
    <SearchCreateField
      options={options}
      displayValue={selected?.name || selectedName || ''}
      selectedId={selected?.id}
      placeholder="Search category…"
      hasError={hasError}
      addNoun="category"
      compact
      onSelect={(opt) => {
        const cat = categories.find((c) => c.id === opt.id);
        if (cat) onSelect(cat);
      }}
      onClear={onClear}
      onCreate={async (name) => {
        const res = await masterApi.chatCreateCategory({
          name,
          requestType: requestType || 'All',
        });
        onCreated(res.data);
        onSelect(res.data);
      }}
    />
  );
}
