import Avatar from '../../../components/base/Avatar';
import ProgressBar from '../../../components/base/ProgressBar';
import { RAGBadge, PriorityBadge, StatusBadge } from '../../../components/base/Badge';
import Skeleton from '../../../components/base/Skeleton';
const COLUMNS = ['Project Name', 'Owner', 'Priority', 'Status', 'Progress', 'Start Date', 'End Date', 'Health'];
export default function ProjectTable({ projects, onRowClick, loading = false }) {
    return (<div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-100">
              {COLUMNS.map((col) => (<th key={col} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {col}
                  {['Project Name', 'Owner', 'Start Date', 'End Date'].includes(col) && (<i className="ri-arrow-up-down-line ml-1 opacity-40"/>)}
                </th>))}
            </tr>
          </thead>

          {loading ? (<Skeleton rows={6}/>) : (<tbody>
              {projects.length === 0 ? (<tr>
                  <td colSpan={COLUMNS.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <i className="ri-folder-search-line text-4xl text-gray-200"/>
                      <p className="text-gray-400 text-sm">No projects found</p>
                    </div>
                  </td>
                </tr>) : (projects.map((project) => (<tr key={project.id} onClick={() => onRowClick(project)} className="border-b border-gray-50 cursor-pointer group transition-all duration-150 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent">
                    {/* Project Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 flex-shrink-0">
                          <i className="ri-folder-3-line text-blue-500 text-sm"/>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                            {project.name}
                          </p>
                          <p className="text-xs text-gray-400">{project.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar initials={project.ownerAvatar} size="xs"/>
                        <span className="text-sm text-gray-600 whitespace-nowrap">{project.owner}</span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-5 py-4">
                      <PriorityBadge priority={project.priority}/>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusBadge status={project.status}/>
                    </td>

                    {/* Progress */}
                    <td className="px-5 py-4 w-44">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={project.progress} size="sm" className="flex-1 min-w-[80px]"/>
                        <span className="text-xs text-gray-500 w-9 text-right flex-shrink-0">{project.progress}%</span>
                      </div>
                    </td>

                    {/* Start Date */}
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600 whitespace-nowrap">{project.startDate}</span>
                    </td>

                    {/* End Date */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-600 whitespace-nowrap">{project.endDate}</span>
                        <i className="ri-time-line text-gray-300 text-xs" title="Auto-calculated based on tasks"/>
                        {project.agingDays > 0 && (<span className={`text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${project.agingDays >= 10 ? 'bg-red-50 text-red-500' :
                        project.agingDays >= 4 ? 'bg-amber-50 text-amber-500' :
                            'bg-emerald-50 text-emerald-500'}`}>
                            +{project.agingDays}d
                          </span>)}
                      </div>
                    </td>

                    {/* Health */}
                    <td className="px-5 py-4">
                      <RAGBadge health={project.health}/>
                    </td>
                  </tr>)))}
            </tbody>)}
        </table>
      </div>

      {projects.length > 0 && (<div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">{projects.length} projects displayed</p>
          <div className="flex items-center gap-1">
            {[1].map((p) => (<button key={p} className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium cursor-pointer transition-all bg-gradient-to-r from-blue-500 to-emerald-500 text-white`}>
                {p}
              </button>))}
          </div>
        </div>)}
    </div>);
}
