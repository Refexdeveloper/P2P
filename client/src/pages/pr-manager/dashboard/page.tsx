import { Navigate, useLocation } from 'react-router-dom';

/** PR Manager / L2 home — use the shared My Tasks experience (keep email deep-link query). */
export default function PRManagerDashboard() {
  const location = useLocation();
  const search = location.search || '';
  return <Navigate to={`/tasks${search}`} replace />;
}
