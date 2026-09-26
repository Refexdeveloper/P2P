const sizeStyles = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
};
const gradients = [
    'from-blue-400 to-emerald-400',
    'from-emerald-400 to-amber-400',
    'from-amber-400 to-orange-400',
    'from-purple-400 to-pink-400',
    'from-cyan-400 to-blue-400',
    'from-rose-400 to-amber-400',
];
function getGradient(initials) {
    const idx = initials.charCodeAt(0) % gradients.length;
    return gradients[idx];
}
export default function Avatar({ initials, size = 'md', gradient, className = '' }) {
    const g = gradient ?? getGradient(initials);
    return (<div className={`
        ${sizeStyles[size]}
        flex items-center justify-center rounded-full
        bg-gradient-to-br ${g} text-white font-bold flex-shrink-0
        ${className}
      `}>
      {initials.slice(0, 2).toUpperCase()}
    </div>);
}
