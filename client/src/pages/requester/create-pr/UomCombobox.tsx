import { useMemo, useState } from 'react';
import SearchCreateField from './SearchCreateField';

/** Common procurement UOMs — user can add any missing type. */
export const DEFAULT_UOM_OPTIONS = [
  'Nos',
  'Pcs',
  'Set',
  'Pair',
  'Box',
  'Pack',
  'Bag',
  'Bundle',
  'Roll',
  'Kg',
  'g',
  'Ton',
  'Litre',
  'ml',
  'Meter',
  'cm',
  'Sq.m',
  'Sq.ft',
  'Hour',
  'Day',
  'Month',
  'Lot',
  'Job',
] as const;

interface Props {
  value?: string;
  hasError?: boolean;
  /** Extra units from Item Master / prior lines so they appear in the list. */
  extraUnits?: string[];
  onChange: (unit: string) => void;
}

export default function UomCombobox({ value, hasError, extraUnits = [], onChange }: Props) {
  const [customUnits, setCustomUnits] = useState<string[]>([]);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; label: string }[] = [];
    const push = (raw: string) => {
      const label = String(raw || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ id: label, label });
    };
    DEFAULT_UOM_OPTIONS.forEach(push);
    extraUnits.forEach(push);
    customUnits.forEach(push);
    if (value) push(value);
    return list;
  }, [extraUnits, customUnits, value]);

  return (
    <SearchCreateField
      options={options}
      displayValue={value || ''}
      selectedId={value || null}
      placeholder="Select or add UOM…"
      hasError={hasError}
      addNoun="UOM"
      compact
      onSelect={(opt) => onChange(opt.label)}
      onClear={() => onChange('')}
      onCreate={async (name) => {
        const unit = name.trim();
        if (!unit) return;
        setCustomUnits((prev) =>
          prev.some((u) => u.toLowerCase() === unit.toLowerCase()) ? prev : [...prev, unit]
        );
        onChange(unit);
      }}
    />
  );
}
