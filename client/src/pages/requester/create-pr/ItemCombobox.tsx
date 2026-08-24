import { useMemo } from 'react';
import { ItemRecord, masterApi } from '../../../services/api';
import SearchCreateField from './SearchCreateField';

interface Props {
  items: ItemRecord[];
  selectedId?: number | null;
  selectedName?: string;
  hasError?: boolean;
  categoryId?: number | null;
  onSelect: (item: ItemRecord) => void;
  onClear: () => void;
  onCreated: (item: ItemRecord) => void;
}

export default function ItemCombobox({
  items,
  selectedId,
  selectedName,
  hasError,
  categoryId,
  onSelect,
  onClear,
  onCreated,
}: Props) {
  const options = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: item.name,
        subLabel: item.itemCode || undefined,
      })),
    [items]
  );

  return (
    <SearchCreateField
      options={options}
      displayValue={items.find((m) => m.id === selectedId)?.name || selectedName || ''}
      selectedId={selectedId}
      placeholder="Search item by name or code…"
      hasError={hasError}
      addNoun="item"
      compact
      onSelect={(opt) => {
        const item = items.find((m) => m.id === opt.id);
        if (item) onSelect(item);
      }}
      onClear={onClear}
      onCreate={async (name) => {
        const res = await masterApi.chatCreateItem({
          name,
          categoryId: categoryId || null,
          unit: 'Nos',
        });
        onCreated(res.data);
        onSelect(res.data);
      }}
    />
  );
}
