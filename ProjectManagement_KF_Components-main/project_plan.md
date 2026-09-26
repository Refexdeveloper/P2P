# ProjectFlow — Project Management System

## 1. Project Description
ProjectFlow is an enterprise-grade Project Management System designed for organizations to track projects, tasks, and team performance. It serves three user roles: CTO (executive view), Project Manager (project & team management), and Team Members (task execution). The system focuses on smart automation (auto date calculation), clear RAG status visibility, and role-based dashboards.

## 2. Page Structure
- `/` → Redirect to `/dashboard`
- `/dashboard` — CTO Dashboard (executive overview)
- `/pm-dashboard` — Project Manager Dashboard
- `/employee-dashboard` — Team Member / User Dashboard
- `/projects` — Projects List + Project Detail Drawer
- `/tasks` — Task Management
- `/reports` — Reports & Analytics
- `/help` — Help & Documentation

## 3. Core Features
- [x] Persistent sidebar navigation with active state
- [x] Fixed topbar with search, notifications, profile
- [x] CTO Dashboard: KPIs, RAG chart, high-risk projects, aging table, integration status
- [x] PM Dashboard: My projects, task progress, overdue tasks, team workload
- [x] Employee Dashboard: My tasks, quick add personal task, task status updates
- [x] Projects: Table view, create project modal (auto Project ID), slide-in drawer
- [x] Tasks: Task list, add task modal, checkbox completion with auto close date
- [x] Auto end date calculation based on task durations
- [x] RAG health indicators (Red/Amber/Green) with animations
- [x] Loading skeleton states for tables
- [x] Reports page with charts
- [x] Help page

## 4. Data Model Design (Frontend Mock)

### Projects
| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated (PRJ-XXXX) |
| name | string | Project name |
| resource | string | Assigned resource |
| lineOfBusiness | string | LOB |
| category | 'New' \| 'CR' | Project type |
| priority | 'High' \| 'Medium' \| 'Low' | Priority level |
| startDate | string | ISO date |
| endDate | string | Auto-calculated |
| owner | string | Project owner |
| sponsor | string | Sponsor |
| deliveryOwner | string | Delivery owner |
| status | string | Active / On Hold / Completed |
| health | 'Red' \| 'Amber' \| 'Green' | RAG status |

### Tasks
| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| projectId | string | FK to project |
| name | string | Task name |
| assignee | string | Assignee name |
| startDate | string | ISO date |
| estimatedClosureDate | string | ISO date |
| actualClosureDate | string \| null | Auto-filled on complete |
| status | 'Pending' \| 'In Progress' \| 'Completed' | Task status |
| durationDays | number | Calculated from dates |

## 5. Backend / Third-party Integration Plan
- Supabase: Not required in Phase 1 — mock data used
- Shopify: Not applicable
- Stripe: Not applicable

## 6. Development Phase Plan

### Phase 1: Core UI + All Pages (CURRENT)
- Goal: Build full UI with mock data for all 6+ pages
- Deliverable: Working navigable prototype with all major screens

### Phase 2: Supabase Integration (Future)
- Goal: Real data persistence (projects, tasks, users)
- Deliverable: Auth + database-backed CRUD

### Phase 3: Advanced Features (Future)
- Goal: Notifications, file attachments, audit logs, email alerts
- Deliverable: Production-ready system
