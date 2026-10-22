# Public Vendor API

No login token. These three URLs are separate from the login-protected `/api/vendors` routes.

Base URL: `https://p2p-backend-645830234926.asia-south1.run.app`

Swagger UI: `https://p2p-backend-645830234926.asia-south1.run.app/api/docs`  
Local Swagger UI: `http://localhost:5000/api/docs`

The Swagger page lists every P2P API. These three public vendor calls include request and response fields.

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/api/vendors/public` | List active vendors |
| GET | `/api/vendors/public/{id}` | Get one vendor |
| POST | `/api/vendors/public` | Create a vendor |

The live host serves these after the API is deployed. Locally they are on `http://localhost:5000`.

Public responses do not include bank account, PAN, IFSC, or documents.

---

## 1. List vendors

`GET /api/vendors/public`

Query parameters are optional.

| Query | Description |
|-------|-------------|
| `search` | Matches name, email, vendor code, category, or contact name |
| `page` | Page number. Default `1` |
| `limit` | Page size. Default `50`, maximum `100` |

Example:

```http
GET /api/vendors/public?search=acme&page=1&limit=50
```

`200` response:

```json
{
  "data": [
    {
      "id": 12,
      "vendorCode": "VEN-00012",
      "name": "Acme Supplies",
      "vendorType": "Company",
      "gstNumber": "",
      "email": "vendor@example.com",
      "phone": "9876543210",
      "address": "",
      "category": "",
      "contactName": "",
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 2. Get one vendor

`GET /api/vendors/public/{id}`

Example:

```http
GET /api/vendors/public/12
```

`200` response:

```json
{
  "data": {
    "id": 12,
    "vendorCode": "VEN-00012",
    "name": "Acme Supplies",
    "vendorType": "Company",
    "gstNumber": "",
    "email": "vendor@example.com",
    "phone": "9876543210",
    "address": "",
    "category": "",
    "contactName": "",
    "status": "active"
  }
}
```

`404` when the id is missing or the vendor is not active:

```json
{ "message": "Vendor not found" }
```

---

## 3. Create a vendor

`POST /api/vendors/public`

Header: `Content-Type: application/json`

| Field | Required | Description |
|-------|----------|-------------|
| `vendorName` or `name` | Yes | Vendor name |
| `email` | Yes | Must be unique |
| `phone` | No | |
| `vendorType` | No | `Company` or `Individual`. Default `Company` |
| `gstNumber` | No | |
| `address` | No | |
| `category` | No | |
| `contactName` | No | |
| `panNumber` | No | Stored, not returned by the public GET |
| `accountNumber` | No | Stored, not returned by the public GET |
| `ifscCode` | No | Stored, not returned by the public GET |
| `bankName` | No | Stored, not returned by the public GET |
| `branch` | No | Stored, not returned by the public GET |

Example:

```http
POST /api/vendors/public
Content-Type: application/json

{
  "vendorName": "Acme Supplies",
  "email": "vendor@example.com",
  "phone": "9876543210",
  "vendorType": "Company",
  "gstNumber": "",
  "address": "",
  "category": "",
  "contactName": ""
}
```

`201` response:

```json
{
  "data": {
    "id": 12,
    "vendorCode": "VEN-00012",
    "name": "Acme Supplies",
    "vendorType": "Company",
    "gstNumber": "",
    "email": "vendor@example.com",
    "phone": "9876543210",
    "address": "",
    "category": "",
    "contactName": "",
    "status": "active"
  },
  "message": "Vendor VEN-00012 created successfully"
}
```

`400` examples:

```json
{ "message": "Vendor name is required" }
```

```json
{ "message": "Email is required" }
```

```json
{ "message": "A vendor with this email already exists" }
```
