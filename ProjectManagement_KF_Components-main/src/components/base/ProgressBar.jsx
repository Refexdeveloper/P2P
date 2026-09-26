const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
};
export default function ProgressBar({ value, max = 100, size = 'md', showLabel = false, gradient = 'from-blue-500 via-emerald-500 to-amber-400', className = '', animated = true, }) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (<div className={`w-full ${className}`}>
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${sizeStyles[size]}`}>
        <div className={`${sizeStyles[size]} rounded-full bg-gradient-to-r ${gradient} ${animated ? 'transition-all duration-1000' : ''}`} style={{ width: `${pct}%` }}/>
      </div>
      {showLabel && (<div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{value} / {max}</span>
          <span className="text-xs font-medium text-gray-600">{Math.round(pct)}%</span>
        </div>)}
    </div>);
}
