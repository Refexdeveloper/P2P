import AppLayout from '../../components/feature/AppLayout';
const faqs = [
    { q: 'How is the Project End Date calculated?', a: 'The end date is automatically calculated based on the sum of task durations. As tasks are added, the system updates the end date by chaining task start and estimated closure dates sequentially from the project start date.' },
    { q: 'What does the RAG status mean?', a: 'RAG stands for Red-Amber-Green. Green = on track, Amber = near risk (1-3 days delay or approaching deadline), Red = delayed or critical risk (4+ days overdue). The status is auto-determined based on actual vs. estimated dates.' },
    { q: 'How do I mark a task as complete?', a: 'Click the circular checkbox to the left of any task row, or use the quick-action checkmark that appears when you hover over a task. The Actual Closure Date will be auto-filled with today\'s date.' },
    { q: 'What is the difference between "New" and "CR" project categories?', a: '"New" indicates a greenfield project with no prior baseline. "CR" (Change Request) indicates a modification to an existing system or project. The distinction helps in resource planning and approval workflows.' },
    { q: 'How do I add a personal task not linked to a project?', a: 'Navigate to the Employee Dashboard and click "Add Personal Task". These tasks appear in your workspace but don\'t affect any project timelines.' },
    { q: 'What are the three dashboard views?', a: 'CTO Dashboard provides executive overview with RAG charts and integration status. PM Dashboard shows your projects, team workload, and upcoming deadlines. Employee Dashboard is your personal task workspace.' },
];
const guides = [
    { icon: 'ri-folder-add-line', title: 'Creating a Project', desc: 'Go to Projects → Create Project. Fill in name, resource, LOB, and dates. Project ID is auto-generated.', color: 'from-blue-400 to-blue-500' },
    { icon: 'ri-task-line', title: 'Adding Tasks', desc: 'Open any project row to view the detail drawer, then click "Add Task" at the bottom of the drawer.', color: 'from-emerald-400 to-emerald-500' },
    { icon: 'ri-bar-chart-2-line', title: 'Reading Reports', desc: 'Navigate to Reports to view RAG distribution, priority breakdown, progress charts, and LOB summary.', color: 'from-amber-400 to-amber-500' },
    { icon: 'ri-user-3-line', title: 'Team Workload', desc: 'View team workload from the PM Dashboard. See completed vs total tasks per team member.', color: 'from-rose-400 to-rose-500' },
];
export default function HelpPage() {
    return (<AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Help & Documentation</h1>
        <p className="text-sm text-gray-400 mt-0.5">Everything you need to get the most out of ProjectFlow</p>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 rounded-2xl p-8 mb-6 text-white">
        <h2 className="text-xl font-bold mb-2">Welcome to ProjectFlow</h2>
        <p className="text-white/80 text-sm max-w-2xl">An enterprise-grade project management system with smart automation, real-time RAG health tracking, and role-based dashboards for CTO, Project Managers, and team members.</p>
        <div className="flex items-center gap-3 mt-5">
          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2 text-sm font-medium">
            <i className="ri-book-open-line"/>Quick Start Guide
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2 text-sm font-medium">
            <i className="ri-video-line"/>Watch Tutorial
          </div>
        </div>
      </div>

      {/* Quick Guides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {guides.map((g) => (<div key={g.title} className="bg-white rounded-2xl border border-gray-100 p-5 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br ${g.color} mb-3`}>
              <i className={`${g.icon} text-white text-lg`}/>
            </div>
            <h3 className="text-sm font-bold text-gray-800 mb-1.5">{g.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{g.desc}</p>
          </div>))}
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-base font-bold text-gray-800 mb-5">Frequently Asked Questions</h3>
        <div className="space-y-4">
          {faqs.map((faq, i) => (<details key={i} className="group border border-gray-100 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-all list-none">
                <span className="text-sm font-semibold text-gray-800">{faq.q}</span>
                <i className="ri-arrow-down-s-line text-gray-400 group-open:rotate-180 transition-transform duration-200 flex-shrink-0 ml-3"/>
              </summary>
              <div className="px-5 pb-4 pt-1">
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            </details>))}
        </div>
      </div>

      {/* Contact */}
      <div className="mt-5 bg-gray-50 border border-gray-100 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Need more help?</h3>
          <p className="text-xs text-gray-500 mt-0.5">Contact your system administrator or raise a support ticket.</p>
        </div>
        <button className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all cursor-pointer whitespace-nowrap">
          <i className="ri-mail-line mr-2"/>Contact Support
        </button>
      </div>
    </AppLayout>);
}
