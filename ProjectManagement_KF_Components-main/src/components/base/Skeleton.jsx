export function SkeletonBlock({ className = '' }) {
    return (<div className={`
        bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100
        rounded-lg animate-pulse ${className}
      `}/>);
}
export function SkeletonTableRow() {
    return (<tr className="border-b border-gray-50">
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-36"/></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-24"/></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-16"/></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-20"/></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-24"/></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-24"/></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-14 rounded-full"/></td>
    </tr>);
}
export function SkeletonCard() {
    return (<div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-28"/>
          <SkeletonBlock className="h-8 w-20"/>
        </div>
        <SkeletonBlock className="h-12 w-12 rounded-2xl"/>
      </div>
      <SkeletonBlock className="h-3 w-20"/>
    </div>);
}
export default function Skeleton({ rows = 6 }) {
    return (<tbody>
      {Array.from({ length: rows }).map((_, i) => (<SkeletonTableRow key={i}/>))}
    </tbody>);
}
