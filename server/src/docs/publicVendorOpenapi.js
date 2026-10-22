const vendor = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 12 },
    vendorCode: { type: 'string', example: 'VEN-00012' },
    name: { type: 'string', example: 'Acme Supplies' },
    vendorType: { type: 'string', example: 'Company' },
    gstNumber: { type: 'string', example: '' },
    email: { type: 'string', example: 'vendor@example.com' },
    phone: { type: 'string', example: '9876543210' },
    address: { type: 'string', example: '' },
    category: { type: 'string', example: '' },
    contactName: { type: 'string', example: '' },
    status: { type: 'string', example: 'active' },
  },
};

export const publicVendorOpenapi = {
  openapi: '3.0.3',
  info: {
    title: 'P2P Public Vendor API',
    version: '1.0.0',
    description:
      'Public vendor master. No login token. Bank account, PAN, and documents are not returned.',
  },
  servers: [
    { url: 'https://p2p-backend-645830234926.asia-south1.run.app', description: 'Live API' },
    { url: 'http://localhost:5000', description: 'Local API' },
  ],
  tags: [{ name: 'Public vendors' }],
  paths: {
    '/api/vendors/public': {
      get: {
        tags: ['Public vendors'],
        summary: 'List active vendors',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Name, email, vendor code, category, or contact name' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Vendor page',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: vendor },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Public vendors'],
        summary: 'Create a vendor',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['vendorName', 'email'],
                properties: {
                  vendorName: { type: 'string', example: 'Acme Supplies' },
                  name: { type: 'string', description: 'Alternate for vendorName' },
                  email: { type: 'string', example: 'vendor@example.com' },
                  phone: { type: 'string', example: '9876543210' },
                  vendorType: { type: 'string', enum: ['Company', 'Individual'], default: 'Company' },
                  gstNumber: { type: 'string' },
                  address: { type: 'string' },
                  category: { type: 'string' },
                  contactName: { type: 'string' },
                  panNumber: { type: 'string', description: 'Stored. Not returned by the public GET.' },
                  accountNumber: { type: 'string', description: 'Stored. Not returned by the public GET.' },
                  ifscCode: { type: 'string', description: 'Stored. Not returned by the public GET.' },
                  bankName: { type: 'string' },
                  branch: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Vendor created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: vendor,
                    message: { type: 'string', example: 'Vendor VEN-00012 created successfully' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Missing name, missing email, or duplicate email',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/vendors/public/{id}': {
      get: {
        tags: ['Public vendors'],
        summary: 'Get one active vendor',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'Vendor',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: vendor } },
              },
            },
          },
          404: {
            description: 'Vendor not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string', example: 'Vendor not found' } },
                },
              },
            },
          },
        },
      },
    },
  },
};
