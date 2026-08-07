import { Navigate } from 'react-router-dom';

/** PR Manager / L2 home — use the shared My Tasks experience. */
export default function PRManagerDashboard() {
  return <Navigate to="/tasks" replace />;
}
