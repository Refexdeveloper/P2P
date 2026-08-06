import { parseRefexOneSamlResponse } from '../src/services/refexOneSamlService.js';

const xml = `<?xml version="1.0"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">sathishkumar.r@refex.co.in</saml:NameID>
    </saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="displayName"><saml:AttributeValue>Sathishkumar R</saml:AttributeValue></saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

const b64 = Buffer.from(xml).toString('base64');
const profile = await parseRefexOneSamlResponse(b64);
console.log('profile', profile);

const res = await fetch('http://localhost:5000/api/auth/refexone/saml/acs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ SAMLResponse: b64 }).toString(),
  redirect: 'manual',
});
console.log('status', res.status);
console.log('location', res.headers.get('location'));
