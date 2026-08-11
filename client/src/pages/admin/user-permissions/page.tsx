import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { adminApi, AdminUserRecord, AdminRoleRecord, NavItem } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { formatRoleDisplayName } from '../../../utils/roleDisplay';

export default function UserPermissionsPage() {
  const { refreshUser } = useAuth();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [catalog, setCatalog] = useState<NavItem[]>([]);
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    try {
      const [usersRes, permRes, rolesRes] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listPermissions(),
        adminApi.listRoles(),
      ]);
      setUsers(usersRes.data);
      setCatalog(permRes.data);
      setRoles(rolesRes.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;

  useEffect(() => {
    if (selectedUser) {
      setSelectedRole(selectedUser.role);
      setSelectedPerms([...selectedUser.permissions]);
    }
  }, [selectedUser]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search, roleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    for (const item of catalog) {
      const g = item.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }, [catalog]);

  const roleChanged = selectedUser ? selectedRole !== selectedUser.role : false;
  const permsChanged = selectedUser
    ? JSON.stringify([...selectedPerms].sort()) !== JSON.stringify([...selectedUser.permissions].sort())
    : false;
  const hasChanges = roleChanged || permsChanged;

  const togglePerm = (code: string) => {
    setSelectedPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const applyRoleDefaults = () => {
    const roleEntry = roles.find((r) => r.role === selectedRole);
    if (roleEntry) {
      setSelectedPerms([...roleEntry.defaultPermissions]);
      showToast(`Applied default menus for ${selectedRole}`, 'success');
    }
  };

  const handleSyncFromRefexOne = async () => {
    setSyncing(true);
    try {
      const res = await adminApi.syncUsers();
      setUsers(res.data);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to sync users from RefexOne', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetData = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      showToast('Type RESET to confirm', 'error');
      return;
    }
    setResetting(true);
    try {
      const res = await adminApi.resetData('RESET');
      showToast(res.message || 'All data reset successfully', 'success');
      setShowResetModal(false);
      setResetConfirmText('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset data', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUserId || !selectedUser || selectedUser.isSuperAdmin || !hasChanges) return;
    setSaving(true);
    try {
      const payload: { role?: string; permissions?: string[] } = {};
      if (roleChanged) payload.role = selectedRole;
      if (permsChanged || roleChanged) payload.permissions = selectedPerms;

      await adminApi.updateUser(selectedUserId, payload);
      showToast(`Updated role and permissions for ${selectedUser.name}`, 'success');
      await load();
      await refreshUser();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Super Admin — sync users from RefexOne, assign roles and navigation menus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setResetConfirmText('');
              setShowResetModal(true);
            }}
            disabled={resetting || loading}
            className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <i className="ri-delete-bin-2-line"></i>
            Reset Data
          </button>
          <button
            type="button"
            onClick={handleSyncFromRefexOne}
            disabled={syncing || loading}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <i className={syncing ? 'ri-loader-4-line animate-spin' : 'ri-cloud-download-line'}></i>
            {syncing ? 'Syncing...' : 'Sync from RefexOne'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User list */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Users</h2>
              <span className="text-xs text-gray-500">{filteredUsers.length} total</span>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {formatRoleDisplayName(r.role)}
                  </option>
                ))}
                <option value="Super Admin">Super Admin</option>
              </select>
            </div>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Loading users...</p>
          ) : (
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {pagedUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedUserId === u.id ? 'bg-teal-50 border-l-4 border-teal-600' : ''
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {formatRoleDisplayName(u.role)}
                    </span>
                    {u.source === 'refexone' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-600">RefexOne</span>
                    )}
                    <span className="text-xs text-teal-600">{u.permissions.length} menus</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!loading && filteredUsers.length > pageSize && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-xs font-medium text-teal-700 disabled:text-gray-300 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="text-xs font-medium text-teal-700 disabled:text-gray-300 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Permission editor */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-sm">
          {!selectedUser ? (
            <div className="py-20 text-center">
              <i className="ri-user-settings-line text-5xl text-gray-200 mb-4 block"></i>
              <p className="text-gray-500 text-sm">Select a user to manage their role and navigation permissions</p>
            </div>
          ) : selectedUser.isSuperAdmin ? (
            <div className="py-20 text-center px-6">
              <i className="ri-shield-star-line text-5xl text-amber-300 mb-4 block"></i>
              <p className="text-gray-700 font-medium">Super Admin has all navigation access</p>
              <p className="text-sm text-gray-500 mt-1">Role and permissions cannot be modified for Super Admin accounts.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{selectedUser.name}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <i className="ri-save-line"></i>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <div className="min-w-[220px]">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      User Role
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => {
                        const nextRole = e.target.value;
                        setSelectedRole(nextRole);
                        const roleEntry = roles.find((r) => r.role === nextRole);
                        if (roleEntry) {
                          setSelectedPerms([...roleEntry.defaultPermissions]);
                          showToast(`Menus updated for role: ${nextRole}`, 'success');
                        }
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {roles.map((r) => (
                        <option key={r.role} value={r.role}>
                          {formatRoleDisplayName(r.role)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={applyRoleDefaults}
                    className="px-4 py-2.5 border border-teal-200 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-50 cursor-pointer flex items-center gap-2"
                  >
                    <i className="ri-refresh-line"></i>
                    Apply role default menus
                  </button>
                  {roleChanged && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <i className="ri-information-line"></i>
                      Role changed — default menus applied. Click Save Changes.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 max-h-[520px] overflow-y-auto space-y-6">
                {Object.entries(groupedCatalog).map(([group, items]) => (
                  <div key={group}>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{group}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((item) => {
                        const checked = selectedPerms.includes(item.code);
                        return (
                          <label
                            key={item.code}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              checked ? 'border-teal-300 bg-teal-50/60' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePerm(item.code)}
                              className="mt-0.5 text-teal-600 rounded"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                <i className={`${item.icon} text-teal-600`}></i>
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{item.path}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                Reset All Data
              </h2>
              <button
                type="button"
                onClick={() => !resetting && setShowResetModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                This permanently deletes <strong>PRs, POs, and RFQs</strong> only (including related
                approvals, tasks, line items, and document number sequences).
              </p>
              <p className="text-sm text-gray-600">
                Kept: <strong>users</strong>, <strong>permissions</strong>, <strong>departments</strong>,
                and all <strong>master data</strong> (vendors, items, entities, letterheads, categories).
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Type <span className="font-mono text-red-600">RESET</span> to confirm
                </label>
                <input
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  disabled={resetting}
                  className="w-full px-3 py-2.5 border border-red-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetData}
                disabled={resetting || resetConfirmText.trim().toUpperCase() !== 'RESET'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer inline-flex items-center gap-2"
              >
                <i className={resetting ? 'ri-loader-4-line animate-spin' : 'ri-delete-bin-2-line'}></i>
                {resetting ? 'Resetting…' : 'Reset All Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${
            toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}>
            <i className={toast.type === 'success' ? 'ri-check-double-line' : 'ri-close-circle-line'}></i>
            {toast.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
