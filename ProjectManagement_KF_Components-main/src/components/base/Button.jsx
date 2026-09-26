const variantStyles = {
    gradient: 'bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 text-white shadow-md hover:shadow-lg hover:opacity-90',
    outline: 'border border-blue-400 text-blue-600 bg-white hover:bg-blue-50',
    ghost: 'text-gray-600 bg-transparent hover:bg-gray-100',
    danger: 'border border-red-300 text-red-600 bg-white hover:bg-red-50',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
};
const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
};
export default function Button({ children, variant = 'gradient', size = 'md', icon, loading = false, className = '', disabled, ...rest }) {
    return (<button {...rest} disabled={disabled || loading} className={`
        inline-flex items-center justify-center font-medium rounded-xl whitespace-nowrap
        transition-all duration-200 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}>
      {loading ? (<i className="ri-loader-4-line animate-spin"/>) : icon ? (<i className={icon}/>) : null}
      {children}
    </button>);
}
