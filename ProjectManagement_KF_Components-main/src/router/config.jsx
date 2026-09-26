import { Navigate } from "react-router-dom";
import NotFound from "../pages/NotFound";
import DashboardPage from "../DashboardPage.jsx";
import EmployeeDashboardPage from "../EmployeeDashboardPage.jsx";
import ProjectsPage from "../ProjectsPage.jsx";
import TasksPage from "../TasksPage.jsx";
import ReportsPage from "../ReportsPage.jsx";
import HelpPage from "../HelpPage.jsx";

const routes = [
    { path: "/", element: <Navigate to="/dashboard" replace/> },
    { path: "/dashboard", element: <DashboardPage /> },
    { path: "/employee-dashboard", element: <EmployeeDashboardPage /> },
    { path: "/projects", element: <ProjectsPage /> },
    { path: "/tasks", element: <TasksPage /> },
    { path: "/reports", element: <ReportsPage /> },
    { path: "/help", element: <HelpPage /> },
    { path: "*", element: <NotFound /> },
];

export default routes;
