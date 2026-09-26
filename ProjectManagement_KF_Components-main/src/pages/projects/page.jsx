import { useState, useMemo } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import Button from '../../components/base/Button';
import ProjectTable from './components/ProjectTable';
import ProjectDrawer from './components/ProjectDrawer';
import CreateProjectModal from './components/CreateProjectModal';
import { mockProjects } from '../../mocks/projects';
export default function ProjectsPage() {
    const [projects, setProjects] = useState(mockProjects);
    const [selectedProject, setSelectedProject] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [healthFilter, setHealthFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const filtered = useMemo(() => {
        return projects.filter((p) => {
            const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.id.toLowerCase().includes(search.toLowerCase()) ||
                p.owner.toLowerCase().includes(search.toLowerCase());
            const matchHealth = healthFilter === 'All' || p.health === healthFilter;
            const matchPriority = priorityFilter === 'All' || p.priority === priorityFilter;
            return matchSearch && matchHealth && matchPriority;
        });
    }, [projects, search, healthFilter, priorityFilter]);
    const handleRowClick = (project) => {
        setSelectedProject(project);
        setDrawerOpen(true);
    };
    const handleCreate = (project) => {
        setProjects((prev) => [project, ...prev]);
        setCreateOpen(false);
    };
    return (<AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage and track all enterprise projects
          </p>
        </div>
        <Button icon="ri-add-line" onClick={() => setCreateOpen(true)}>
          Create Project
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex items-center flex-1 min-w-[200px]">
            <i className="ri-search-line absolute left-3 text-gray-400 text-sm"/>
            <input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"/>
          </div>

          {/* Health Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1">
            {['All', 'Green', 'Amber', 'Red'].map((h) => (<button key={h} onClick={() => setHealthFilter(h)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${healthFilter === h
                ? h === 'All' ? 'bg-white text-gray-700 shadow-sm' :
                    h === 'Green' ? 'bg-emerald-500 text-white' :
                        h === 'Amber' ? 'bg-amber-500 text-white' :
                            'bg-red-500 text-white'
                : 'text-gray-500 hover:text-gray-700'}`}>
                {h}
              </button>))}
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1">
            {['All', 'High', 'Medium', 'Low'].map((p) => (<button key={p} onClick={() => setPriorityFilter(p)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${priorityFilter === p
                ? 'bg-white text-gray-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
                {p}
              </button>))}
          </div>

          <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
            {filtered.length} of {projects.length} projects
          </span>
        </div>
      </div>

      {/* Table */}
      <ProjectTable projects={filtered} onRowClick={handleRowClick}/>

      {/* Drawer */}
      <ProjectDrawer project={selectedProject} open={drawerOpen} onClose={() => setDrawerOpen(false)}/>

      {/* Create Modal */}
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate}/>
    </AppLayout>);
}
