import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { publicVendorOpenapi } from './publicVendorOpenapi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, '../routes');
const indexFile = path.resolve(__dirname, '../index.js');

const MOUNTS = [
  ['auth.routes.js', '/api/auth', 'Auth'],
  ['purchaseRequest.routes.js', '/api/purchase-requests', 'Purchase requests'],
  ['task.routes.js', '/api/tasks', 'Tasks'],
  ['rfq.routes.js', '/api/rfq', 'RFQ'],
  ['po.routes.js', '/api/po', 'Purchase orders'],
  ['vendor.routes.js', '/api/vendors', 'Vendors'],
  ['master.routes.js', '/api/masters', 'Masters'],
  ['admin.routes.js', '/api/admin', 'Admin'],
  ['accounts.routes.js', '/api/accounts', 'Accounts'],
  ['cloudSubscription.routes.js', '/api/cloud-subscriptions', 'Cloud subscriptions'],
];

function toOpenApiPath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function joinPath(prefix, routePath) {
  const left = prefix.replace(/\/$/, '');
  const right = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const full = right === '/' ? left : `${left}${right}`;
  return full.replace(/\/+/g, '/');
}

function extractRoutes(source) {
  const re = /(?:router|app)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  const found = [];
  let match = re.exec(source);
  while (match) {
    found.push({ method: match[1].toLowerCase(), routePath: match[2] });
    match = re.exec(source);
  }
  return found;
}

function isPublic(fullPath, method) {
  if (fullPath.startsWith('/api/vendors/public')) return true;
  if (fullPath.startsWith('/api/po/public/')) return true;
  if (fullPath.startsWith('/api/po/vendor-accept/')) return true;
  if (fullPath.startsWith('/api/rfq/quote/')) return true;
  if (fullPath.startsWith('/api/accounts/vendor-invoice/')) return true;
  if (fullPath.startsWith('/api/auth/') && !fullPath.endsWith('/me')) return true;
  if (fullPath.startsWith('/api/health') && method === 'get') return true;
  return false;
}

function parametersFor(openPath) {
  return [...openPath.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function genericOperation(method, openPath, tag, summary) {
  const operation = {
    tags: [tag],
    summary,
    parameters: parametersFor(openPath),
    responses: {
      200: { description: 'Success' },
      400: { description: 'Request error' },
    },
  };
  if (!isPublic(openPath, method)) {
    operation.security = [{ bearerAuth: [] }];
  }
  if (method === 'post' || method === 'put' || method === 'patch') {
    operation.requestBody = {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: true },
        },
      },
    };
  }
  return operation;
}

export function buildOpenapi() {
  const paths = {};

  for (const [file, prefix, tag] of MOUNTS) {
    const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
    for (const route of extractRoutes(source)) {
      const full = toOpenApiPath(joinPath(prefix, route.routePath));
      if (full.startsWith('/api/docs')) continue;
      paths[full] = paths[full] || {};
      const summary = `${route.method.toUpperCase()} ${full}`;
      paths[full][route.method] = genericOperation(route.method, full, tag, summary);
    }
  }

  const indexSource = fs.readFileSync(indexFile, 'utf8');
  for (const route of extractRoutes(indexSource)) {
    if (!route.routePath.startsWith('/api/')) continue;
    const full = toOpenApiPath(route.routePath);
    if (full.startsWith('/api/docs')) continue;
    paths[full] = paths[full] || {};
    paths[full][route.method] = genericOperation(route.method, full, 'Health', `${route.method.toUpperCase()} ${full}`);
  }

  for (const [openPath, methods] of Object.entries(publicVendorOpenapi.paths)) {
    paths[openPath] = { ...(paths[openPath] || {}), ...methods };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'P2P API',
      version: '1.0.0',
      description:
        'All P2P API routes. Login-protected calls need Authorization: Bearer <token>. Public vendor calls are documented with request and response fields.',
    },
    servers: publicVendorOpenapi.servers,
    tags: [
      { name: 'Auth' },
      { name: 'Purchase requests' },
      { name: 'Tasks' },
      { name: 'RFQ' },
      { name: 'Purchase orders' },
      { name: 'Vendors' },
      { name: 'Public vendors' },
      { name: 'Masters' },
      { name: 'Admin' },
      { name: 'Accounts' },
      { name: 'Cloud subscriptions' },
      { name: 'Health' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths,
  };
}
