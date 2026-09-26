import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
const LOB_OPTIONS = ['Enterprise IT', 'Business Intelligence', 'Finance & Accounting', 'Customer Experience', 'Digital Innovation', 'IT Operations', 'Risk & Compliance', 'Human Resources'];
const RESOURCE_OPTIONS = ['Cloud Infrastructure Team', 'Data Analytics Team', 'Finance Tech Team', 'Mobile Dev Team', 'AI/ML Team', 'DevOps Team', 'Security Team', 'HR Tech Team'];
const OWNER_OPTIONS = ['Arjun Mehta', 'Sneha Reddy', 'Deepak Verma', 'Priya Iyer', 'Aditya Kumar', 'Kiran Shah', 'Meera Pillai', 'Rohit Bansal'];
function generateProjectId() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `PRJ-${num}`;
}
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}
export default function CreateProjectModal({ open, onClose, onCreate }) {
    const [form, setForm] = useState({
        name: '',
        id: '',
        resource: RESOURCE_OPTIONS[0],
        lineOfBusiness: LOB_OPTIONS[0],
        category: 'New',
        priority: 'Medium',
        startDate: new Date().toISOString().split('T')[0],
        owner: OWNER_OPTIONS[0],
        sponsor: OWNER_OPTIONS[1],
        deliveryOwner: OWNER_OPTIONS[2],
        description: '',
    });
    const [errors, setErrors] = useState({});
    useEffect(() => {
        if (open) {
            setForm((f) => ({ ...f, id: generateProjectId() }));
            setErrors({});
        }
    }, [open]);
    const endDate = addDays(form.startDate, 90);
    const validate = () => {
        const e = {};
        if (!form.name.trim())
            e.name = 'Project name is required';
        if (!form.startDate)
            e.startDate = 'Start date is required';
        return e;
    };
    const handleSubmit = () => {
        const e = validate();
        if (Object.keys(e).length > 0) {
            setErrors(e);
            return;
        }
        const project = {
            id: form.id,
            name: form.name,
            resource: form.resource,
            lineOfBusiness: form.lineOfBusiness,
            category: form.category,
            priority: form.priority,
            startDate: form.startDate,
            endDate,
            owner: form.owner,
            ownerAvatar: form.owner.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2),
            sponsor: form.sponsor,
            deliveryOwner: form.deliveryOwner,
            status: 'Planning',
            health: 'Green',
            progress: 0,
            agingDays: 0,
            description: form.description || 'No description provided.',
        };
        onCreate(project);
        setForm({ name: '', id: '', resource: RESOURCE_OPTIONS[0], lineOfBusiness: LOB_OPTIONS[0], category: 'New', priority: 'Medium', startDate: new Date().toISOString().split('T')[0], owner: OWNER_OPTIONS[0], sponsor: OWNER_OPTIONS[1], deliveryOwner: OWNER_OPTIONS[2], description: '' });
    };
    const field = (key, value, onChange, type = 'text', disabled = false) => (<div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`w-full px-4 py-2.5 text-sm border rounded-xl transition-all outline-none
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400'}
          ${errors[key] ? 'border-red-300' : 'border-gray-200'}
        `}/>
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>);
    const selectField = (value, onChange, options) => (<select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>);
    const Label = ({ children }) => (<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</label>);
    return (<Modal open={open} onClose={onClose} title="Create New Project" width="max-w-3xl" footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon="ri-add-circle-line" onClick={handleSubmit} disabled={!form.name.trim()}>
            Create Project
          </Button>
        </>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <Label>Project Name *</Label>
            {field('name', form.name, (v) => setForm({ ...form, name: v }))}
          </div>
          <div>
            <Label>Project ID (Auto-generated)</Label>
            {field('id', form.id, () => { }, 'text', true)}
          </div>
          <div>
            <Label>Resource</Label>
            {selectField(form.resource, (v) => setForm({ ...form, resource: v }), RESOURCE_OPTIONS)}
          </div>
          <div>
            <Label>Line of Business</Label>
            {selectField(form.lineOfBusiness, (v) => setForm({ ...form, lineOfBusiness: v }), LOB_OPTIONS)}
          </div>
          <div>
            <Label>Project Category</Label>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
              {['New', 'CR'].map((c) => (<button key={c} onClick={() => setForm({ ...form, category: c })} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${form.category === c
                ? 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
                  {c === 'New' ? 'New Project' : 'Change Request'}
                </button>))}
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={3} placeholder="Brief project description..." className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all resize-none"/>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <Label>Priority</Label>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
              {['High', 'Medium', 'Low'].map((p) => (<button key={p} onClick={() => setForm({ ...form, priority: p })} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${form.priority === p
                ? p === 'High' ? 'bg-red-500 text-white shadow-sm' :
                    p === 'Medium' ? 'bg-amber-500 text-white shadow-sm' :
                        'bg-emerald-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
                  {p}
                </button>))}
            </div>
          </div>
          <div>
            <Label>Start Date *</Label>
            {field('startDate', form.startDate, (v) => setForm({ ...form, startDate: v }), 'date')}
          </div>
          <div>
            <Label>
              End Date (Auto-calculated)
            </Label>
            <div className="w-full px-4 py-2.5 text-sm border border-gray-100 rounded-xl bg-gray-50 text-gray-500 flex items-center gap-2">
              <i className="ri-time-line text-gray-400"/>
              <span>{endDate}</span>
              <span className="text-xs text-gray-400 ml-auto">Based on tasks</span>
            </div>
          </div>
          <div>
            <Label>Project Owner</Label>
            {selectField(form.owner, (v) => setForm({ ...form, owner: v }), OWNER_OPTIONS)}
          </div>
          <div>
            <Label>Sponsor</Label>
            {selectField(form.sponsor, (v) => setForm({ ...form, sponsor: v }), OWNER_OPTIONS)}
          </div>
          <div>
            <Label>Delivery Owner</Label>
            {selectField(form.deliveryOwner, (v) => setForm({ ...form, deliveryOwner: v }), OWNER_OPTIONS)}
          </div>
        </div>
      </div>
    </Modal>);
}
