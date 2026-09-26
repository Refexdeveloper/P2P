import { useState } from 'react';
import Drawer from '../../../components/base/Drawer';
import Button from '../../../components/base/Button';
import Avatar from '../../../components/base/Avatar';
import ProgressBar from '../../../components/base/ProgressBar';
import { RAGBadge, PriorityBadge, StatusBadge } from '../../../components/base/Badge';
import { mockTasks } from '../../../mocks/tasks';
import AddTaskModal from '../../tasks/components/AddTaskModal';
export default function ProjectDrawer({ project, open, onClose }) {
    const [tasks, setTasks] = useState(mockTasks);
    const [addTask, setAddTask] = useState(false);
    const [hovered, setHovered] = useState(null);
    if (!project)
        return null;
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const today = new Date().toISOString().split('T')[0];
    const markComplete = (id) => {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'Completed', actualClosureDate: today } : t));
    };
    const handleAddTask = (task) => {
        setTasks((prev) => [...prev, task]);
        setAddTask(false);
    };
    const infoRows = [
        { label: 'Project ID', value: project.id },
        { label: 'Line of Business', value: project.lineOfBusiness },
        { label: 'Category', value: project.category },
        { label: 'Resource', value: project.resource },
        { label: 'Owner', value: project.owner },
        { label: 'Sponsor', value: project.sponsor },
        { label: 'Delivery Owner', value: project.deliveryOwner },
        { label: 'Start Date', value: project.startDate },
        { label: 'End Date', value: project.endDate },
    ];
    return (<>
      <Drawer open={open} onClose={onClose} title={project.name} subtitle={`${project.id} · ${project.lineOfBusiness}`} footer={<>
            <Button variant="outline" icon="ri-add-line" onClick={() => setAddTask(true)}>
              Add Task
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon="ri-pencil-line">Edit Project</Button>
            </div>
          </>}>
        {/* Overview Section */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <RAGBadge health={project.health}/>
            <PriorityBadge priority={project.priority}/>
            <StatusBadge status={project.status}/>
            {project.agingDays > 0 && (<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                +{project.agingDays}d delayed
              </span>)}
          </div>

          <p className="text-sm text-gray-600 mb-5 leading-relaxed">{project.description}</p>

          {/* Progress */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-bold bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} size="lg"/>
          </div>

          {/* Timeline */}
          <div className="relative bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-center">
                <p className="text-xs text-gray-400">Start Date</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{project.startDate}</p>
              </div>
              <div className="flex-1 mx-4">
                <div className="relative h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 rounded-full transition-all duration-1000" style={{ width: `${project.progress}%` }}/>
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm" style={{ left: `${project.progress}%`, transform: 'translateX(-50%) translateY(-50%)' }}/>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  End Date <i className="ri-time-line text-[10px]"/>
                </p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{project.endDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Project Info Grid */}
        <div className="p-6 border-b border-gray-100">
          <h4 className="text-sm font-bold text-gray-800 mb-3">Project Details</h4>
          <div className="grid grid-cols-2 gap-3">
            {infoRows.map((r) => (<div key={r.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{r.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{r.value}</p>
              </div>))}
          </div>
        </div>

        {/* Task List */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-800">Tasks ({projectTasks.length})</h4>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-500">{projectTasks.filter((t) => t.status === 'Completed').length} done</span>
              <span className="text-gray-300">·</span>
              <span className="text-blue-500">{projectTasks.filter((t) => t.status === 'In Progress').length} in progress</span>
            </div>
          </div>

          <div className="space-y-2">
            {projectTasks.length === 0 && (<div className="text-center py-8">
                <i className="ri-task-line text-3xl text-gray-200"/>
                <p className="text-sm text-gray-400 mt-2">No tasks yet. Add your first task!</p>
              </div>)}
            {projectTasks.map((t) => (<div key={t.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all group cursor-pointer
                  ${t.status === 'Completed' ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-100 hover:border-blue-100 hover:bg-blue-50/20'}
                `} onMouseEnter={() => setHovered(t.id)} onMouseLeave={() => setHovered(null)}>
                <button onClick={(e) => { e.stopPropagation(); markComplete(t.id); }} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer
                    ${t.status === 'Completed' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 hover:border-emerald-400'}
                  `}>
                  {t.status === 'Completed' && <i className="ri-check-line text-white text-[10px]"/>}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${t.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {t.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <Avatar initials={t.assigneeAvatar} size="xs"/>
                      <span className="text-xs text-gray-400">{t.assignee}</span>
                    </div>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">Est: {t.estimatedClosureDate}</span>
                    {t.actualClosureDate && (<>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-emerald-500">Done: {t.actualClosureDate}</span>
                      </>)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                t.status === 'In Progress' ? 'bg-blue-50 text-blue-600' :
                    'bg-gray-100 text-gray-500'}`}>
                    {t.status}
                  </span>
                  {hovered === t.id && t.status !== 'Completed' && (<button onClick={(e) => { e.stopPropagation(); markComplete(t.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition-all cursor-pointer" title="Mark Complete">
                      <i className="ri-check-double-line text-sm"/>
                    </button>)}
                </div>
              </div>))}
          </div>
        </div>
      </Drawer>

      <AddTaskModal open={addTask} onClose={() => setAddTask(false)} onAdd={handleAddTask} projectId={project.id} projectName={project.name} projectStartDate={project.startDate}/>
    </>);
}
