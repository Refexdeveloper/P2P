const variantStyles = {
    red: 'bg-red-50 text-red-600 border border-red-200',
    amber: 'bg-amber-50 text-amber-600 border border-amber-200',
    green: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    blue: 'bg-blue-50 text-blue-600 border border-blue-200',
    gray: 'bg-gray-100 text-gray-600 border border-gray-200',
    gradient: 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white border-0',
};
const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
};
export default function Badge({ children, variant = 'gray', size = 'sm', pulse = false, className = '' }) {
    return (<span className={`
        inline-flex items-center gap-1 font-medium rounded-full whitespace-nowrap
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}>
      {pulse && (<span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${variant === 'red' ? 'bg-red-400' : variant === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}/>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${variant === 'red' ? 'bg-red-500' : variant === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}/>
        </span>)}
      {children}
    </span>);
}
export function RAGBadge({ health }) {
    const map = { Red: 'red', Amber: 'amber', Green: 'green' };
    return <Badge variant={map[health]} pulse={health === 'Red'}>{health}</Badge>;
}
export function PriorityBadge({ priority }) {
    const map = { High: 'red', Medium: 'amber', Low: 'green' };
    return <Badge variant={map[priority]}>{priority}</Badge>;
}
export function StatusBadge({ status }) {
    const map = {
        Active: 'green',
        Planning: 'blue',
        'On Hold': 'amber',
        Completed: 'gray',
        Pending: 'gray',
        'In Progress': 'blue',
    };
    return <Badge variant={map[status] ?? 'gray'}>{status}</Badge>;
}
