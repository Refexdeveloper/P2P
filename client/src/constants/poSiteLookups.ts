import type { PoSiteLookupRecord } from '../services/api';

export function upsertSiteLookup(list: PoSiteLookupRecord[], item: PoSiteLookupRecord) {
  const rest = list.filter(
    (row) => row.id !== item.id && row.label.trim().toLowerCase() !== item.label.trim().toLowerCase()
  );
  return [item, ...rest];
}

export const DEFAULT_SITE_CONTACTS: PoSiteLookupRecord[] = [
  { id: -1, type: 'site_contact', label: 'Sathish Karunanithi', email: 'sathishbabu.k@refex.co.in', phone: '8553656560', status: 'active' },
  { id: -2, type: 'site_contact', label: 'Nirmalantony S', email: 'nirmalantony.s@refex.co.in', phone: '7397783563', status: 'active' },
  { id: -3, type: 'site_contact', label: 'Nambu Santhiya N', email: 'nambu.santhiya@refex.co.in', phone: '8754595292', status: 'active' },
  { id: -4, type: 'site_contact', label: 'Naveen N', email: 'naveen.n@refexfleet.com', phone: '9771127799', status: 'active' },
  { id: -5, type: 'site_contact', label: 'Mohd Sameeuddin', email: 'mohd.sameeuddin@refex.co.in', phone: '7993689327', status: 'active' },
  { id: -6, type: 'site_contact', label: 'Mohd Arif Shaikh', email: 'mohd.arifshaikh@refex.co.in', phone: '9920400371', status: 'active' },
  { id: -7, type: 'site_contact', label: 'Mokthiyar', email: 'mokthiyar.n@refex.co.in', phone: '9844444520', status: 'active' },
  { id: -8, type: 'site_contact', label: 'Arjun Singh', email: 'emco5mw@refex.co.in', phone: '8426895998', status: 'active' },
  { id: -9, type: 'site_contact', label: 'Pushpendra Kumar', email: 'diwana3.25mw@refex.co.in', phone: '9414943645', status: 'active' },
  { id: -10, type: 'site_contact', label: 'Narendra Kumar', email: 'narendra.k@refex.co.in', phone: '9792435433', status: 'active' },
  { id: -11, type: 'site_contact', label: 'Abhilash Ghatage', email: 'abhilash.ag@refex.co.in', phone: '9834684067', status: 'active' },
  { id: -12, type: 'site_contact', label: 'Dhanunjay Patlolla', email: 'dhanunjay.p@refex.co.in', phone: '9043984072', status: 'active' },
  { id: -13, type: 'site_contact', label: 'Suresh Kumar', email: 'sureshkumar.m@refex.co.in', phone: '9782530640', status: 'active' },
  { id: -14, type: 'site_contact', label: 'Nikhil Kumar', email: 'jaipur.cluster.om@refex.co.in', phone: '9837570662', status: 'active' },
  { id: -15, type: 'site_contact', label: 'Jagan Tamilarasu', email: 'jagan.tamilarasu@refex.co.in', phone: '7418635321', status: 'active' },
  { id: -16, type: 'site_contact', label: 'Jaganraj.R', email: 'jaganraj.r@refex.co.in', phone: '8220817153', status: 'active' },
  { id: -17, type: 'site_contact', label: 'Venkatesha', email: 'venkatesha.ncv@refex.co.in', phone: '6381881348', status: 'active' },
  { id: -18, type: 'site_contact', label: 'Praveen', email: 'praveen@vyzagbioenergy.com', phone: '9739841093', status: 'active' },
  { id: -19, type: 'site_contact', label: 'Rajesh Das', email: 'rajeshdas@refex.co.in', phone: '7014049317', status: 'active' },
  { id: -20, type: 'site_contact', label: 'Nitesh Pawar', email: 'nitesh.p@refex.co.in', phone: '7489746407', status: 'active' },
];

export const DEFAULT_PROJECT_MANAGERS: PoSiteLookupRecord[] = [
  { id: -101, type: 'project_manager', label: 'Palani', email: 'palani.c@refex.co.in', phone: '9766865267', status: 'active' },
  { id: -102, type: 'project_manager', label: 'Ramesh', email: 'ramesh.c@refex.co.in', phone: '7550048222', status: 'active' },
  { id: -103, type: 'project_manager', label: 'Sarath Kumar', email: 'sharathkumar.b@refex.co.in', phone: '8754444250', status: 'active' },
  { id: -104, type: 'project_manager', label: 'Babu Rathinam', email: 'babu.r@refex.co.in', phone: '9600811102', status: 'active' },
  { id: -105, type: 'project_manager', label: 'Jones Basil T', email: 'jones.t@refex.co.in', phone: '8220920195', status: 'active' },
  { id: -106, type: 'project_manager', label: 'Sangeetha', email: 'sangeetha.r@refex.co.in', phone: '7305394575', status: 'active' },
  { id: -107, type: 'project_manager', label: 'Chinna Ashok Kumar', email: 'chinna.ashok@refex.co.in', phone: '8122504180', status: 'active' },
];

function mergeLookups(defaults: PoSiteLookupRecord[], apiRows: PoSiteLookupRecord[]) {
  const byName = new Map<string, PoSiteLookupRecord>();
  for (const row of defaults) {
    byName.set(row.label.trim().toLowerCase(), row);
  }
  for (const row of apiRows) {
    const key = row.label.trim().toLowerCase();
    const existing = byName.get(key);
    byName.set(key, {
      ...row,
      email: row.email || existing?.email || '',
      phone: row.phone || existing?.phone || '',
    });
  }
  return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function mergeSiteContacts(apiRows: PoSiteLookupRecord[]) {
  return mergeLookups(DEFAULT_SITE_CONTACTS, apiRows);
}

export function mergeProjectManagers(apiRows: PoSiteLookupRecord[]) {
  return mergeLookups(DEFAULT_PROJECT_MANAGERS, apiRows);
}
