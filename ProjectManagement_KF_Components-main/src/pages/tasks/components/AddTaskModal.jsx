import { useState } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
const ASSIGNEES = ['Arjun Mehta', 'Sneha Reddy', 'Deepak Verma', 'Priya Iyer', 'Aditya Kumar', 'Rahul Kapoor', 'Kavya Singh', 'Meera Pillai', 'Suresh Patel', 'Tarun Das'];
function diffDays(start, end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(0, Math.round((e - s) / 86400000));
}
export default function AddTaskModal({ open, onClose, onAdd, projectId, projectName, projectStartDate }) {
    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({
        name: '',
        assignee: ASSIGNEES[0],
        startDate: today,
        estimatedClosureDate: '',
        status: 'Pending',
    });
    const [error, setError] = useState('');
    const duration = form.startDate && form.estimatedClosureDate ? diffDays(form.startDate, form.estimatedClosureDate) : 0;
    const handleAdd = () => {
        if (!form.name.trim()) {
            setError('Task name is required');
            return;
        }
        if (!form.estimatedClosureDate) {
            setError('Estimated closure date is required');
            return;
        }
        const task = {
            id: `TSK-${Date.now()}`,
            projectId,
            projectName,
            name: form.name,
            assignee: form.assignee,
            assigneeAvatar: form.assignee.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2),
            startDate: form.startDate,
            estimatedClosureDate: form.estimatedClosureDate,
            actualClosureDate: null,
            status: form.status,
            durationDays: duration,
        };
        onAdd(task);
        setForm({ name: '', assignee: ASSIGNEES[0], startDate: today, estimatedClosureDate: '', status: 'Pending' });
        setError('');
    };
    return (<Modal open={open} onClose={onClose} title="Add Task" width="max-w-lg" footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon="ri-add-line" onClick={handleAdd}>Add Task</Button>
        </>}>
      <div className="space-y-4">
        {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Task Name *</label>
          <input type="text" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }} placeholder="Enter task name" className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"/>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assignee</label>
          <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
            {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Est. Closure *</label>
            <input type="date" value={form.estimatedClosureDate} min={form.startDate} onChange={(e) => setForm({ ...form, estimatedClosureDate: e.target.value })} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"/>
          </div>
        </div>
        {duration > 0 && (<div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-2">
            <i className="ri-time-line text-blue-500"/>
            <span className="text-sm font-medium text-blue-700">Task Duration: <strong>{duration} days</strong></span>
          </div>)}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Initial Status</label>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
            {['Pending', 'In Progress'].map((s) => (<button key={s} onClick={() => setForm({ ...form, status: s })} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${form.status === s
                ? s === 'Pending' ? 'bg-white text-gray-700 shadow-sm' : 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
                {s}
              </button>))}
          </div>
        </div>
      </div>
    </Modal>);
}
