
interface TaskFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  categories: { key: string; label: string; count: number }[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export default function TaskFilters({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  priorityFilter,
  onPriorityChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  categories,
  onClearFilters,
  hasActiveFilters,
}: TaskFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input
            type="text"
            placeholder="Search tasks by title, document, or assignee..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          )}
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white cursor-pointer"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white cursor-pointer"
        >
          <option value="dueDate">Sort: Due Date</option>
          <option value="priority">Sort: Priority</option>
          <option value="created">Sort: Newest First</option>
          <option value="amount">Sort: Amount</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
          >
            <i className="ri-filter-off-line"></i> Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onCategoryChange(cat.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === cat.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeCategory === cat.key
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {cat.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
