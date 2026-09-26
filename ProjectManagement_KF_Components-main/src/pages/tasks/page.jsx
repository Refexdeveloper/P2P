import { useState } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import Button from '../../components/base/Button';
import Avatar from '../../components/base/Avatar';
import { mockTasks } from '../../mocks/tasks';
import AddTaskModal from './components/AddTaskModal';
export default function TasksPage() {
    const [tasks, setTasks] = useState(mockTasks);
    const [addOpen, setAddOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [hovered, setHovered] = useState(null);
    const today = new Date().toISOString().split('T')[0];
    const filtered = tasks.filter((t) => {
        const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.assignee.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'All' || t.status === statusFilter;
        return matchSearch && matchStatus;
    });
    const markComplete = (id) => {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'Completed', actualClosureDate: today } : t));
    };
    const updateStatus = (id, status) => {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    };
    const handleAdd = (task) => {
        setTasks((prev) => [task, ...prev]);
        setAddOpen(false);
    };
    const isOverdue = (t) => t.estimatedClosureDate < today && t.status !== 'Completed';
    const statusStyles = {
        Pending: 'bg-gray-100 text-gray-600 border-gray-200',
        'In Progress': 'bg-blue-50 text-blue-600 border-blue-200',
        Completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    };
    return (<AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tasks.length} total tasks across all projects</p>
        </div>
        <Button icon="ri-add-line" onClick={() => setAddOpen(true)}>Add Task</Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
            { label: 'Pending', count: tasks.filter((t) => t.status === 'Pending').length, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-100' },
            { label: 'In Progress', count: tasks.filter((t) => t.status === 'In Progress').length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
            { label: 'Completed', count: tasks.filter((t) => t.status === 'Completed').length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
        ].map((s) => (<div key={s.label} className={`${s.bg} border rounded-2xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 text-gray-400 text-sm top-1/2 -translate-y-1/2"/>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks or assignees..." className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"/>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
          {['All', 'Pending', 'In Progress', 'Completed'].map((s) => (<button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === s ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>))}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} tasks</span>
      </div>

      {/* Task Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-100">
                {['', 'Task', 'Project', 'Assignee', 'Start', 'Est. Close', 'Actual Close', 'Status', 'Actions'].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (<tr><td colSpan={9} className="text-center py-16">
                  <i className="ri-task-line text-4xl text-gray-200"/>
                  <p className="text-gray-400 text-sm mt-2">No tasks found</p>
                </td></tr>)}
              {filtered.map((t) => (<tr key={t.id} className={`border-b border-gray-50 transition-all group ${t.status === 'Completed' ? 'bg-emerald-50/20' :
                isOverdue(t) ? 'bg-red-50/20 hover:bg-red-50/40' :
                    'hover:bg-blue-50/20'}`} onMouseEnter={() => setHovered(t.id)} onMouseLeave={() => setHovered(null)}>
                  <td className="px-4 py-3.5 w-10">
                    <button onClick={() => markComplete(t.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${t.status === 'Completed' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}>
                      {t.status === 'Completed' && <i className="ri-check-line text-white text-[10px]"/>}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 max-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      {isOverdue(t) && <i className="ri-alarm-warning-line text-red-400 text-xs flex-shrink-0"/>}
                      <div>
                        <p className={`text-sm font-medium ${t.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-800'} truncate`}>{t.name}</p>
                        <p className="text-[10px] text-gray-400">{t.id}{t.isPersonal ? ' · Personal' : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {t.projectName ? (<span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2.5 py-1 whitespace-nowrap">{t.projectName}</span>) : (<span className="text-xs text-gray-300">—</span>)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Avatar initials={t.assigneeAvatar} size="xs"/>
                      <span className="text-xs text-gray-600 whitespace-nowrap">{t.assignee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><span className="text-xs text-gray-600 whitespace-nowrap">{t.startDate}</span></td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs whitespace-nowrap font-medium ${isOverdue(t) ? 'text-red-500' : 'text-gray-600'}`}>
                      {t.estimatedClosureDate}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {t.actualClosureDate
                ? <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">{t.actualClosureDate}</span>
                : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)} className={`text-xs font-medium px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${statusStyles[t.status]}`}>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    {hovered === t.id && t.status !== 'Completed' && (<div className="flex items-center gap-1">
                        <button onClick={() => markComplete(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition-all cursor-pointer" title="Complete">
                          <i className="ri-check-double-line text-sm"/>
                        </button>
                      </div>)}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} projectId="" projectName="" projectStartDate={today}/>
    </AppLayout>);
}
