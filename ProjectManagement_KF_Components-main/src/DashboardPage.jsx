import ProjectDashboardPage from './ProjectDashboardPage.jsx';

/** SPA shell route: outer layout on; Kissflow embed uses `ProjectDashboardPage` directly with default `useLayout={false}`. */
export default function DashboardPage(props) {
  return <ProjectDashboardPage useLayout {...props} />;
}
