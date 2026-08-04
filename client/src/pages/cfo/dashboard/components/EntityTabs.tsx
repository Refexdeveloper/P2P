interface Entity {
  id: string;
  name: string;
  code: string;
  color: string;
  allocatedBudget: number;
  utilizedBudget: number;
  utilizationPercentage: number;
  pendingPRsCount: number;
  approvedAmount: number;
}

interface EntityTabsProps {
  entities: Entity[];
  selectedEntity: string;
  onSelectEntity: (entityId: string) => void;
}

export default function EntityTabs({ entities, selectedEntity, onSelectEntity }: EntityTabsProps) {
  return (
    <div className="mb-8">
      <div className="bg-white rounded-xl border border-gray-200 p-2">
        <div className="flex gap-2 overflow-x-auto">
          {/* All Entities Tab */}
          <button
            onClick={() => onSelectEntity('all')}
            className={`px-6 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedEntity === 'all'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <i className="ri-building-4-line mr-2"></i>
            All Entities
          </button>

          {/* Individual Entity Tabs */}
          {entities.map(entity => (
            <button
              key={entity.id}
              onClick={() => onSelectEntity(entity.id)}
              className={`px-6 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedEntity === entity.id
                  ? 'bg-white text-gray-900 shadow-lg border-2'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              style={selectedEntity === entity.id ? { borderColor: entity.color } : {}}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entity.color }}
              ></div>
              {entity.name}
              {entity.pendingPRsCount > 0 && (
                <span 
                  className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: entity.color }}
                >
                  {entity.pendingPRsCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}