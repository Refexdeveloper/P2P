import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { enrichAuthUser } from '../services/permissionService.js';
import {
  authenticateRefexOne,
  authenticateWithRefexOneToken,
  resolveLocalUserFromRefexOne,
  shouldTryRefexOneLogin,
} from '../services/refexOneService.js';
import {
  getRefexOneSamlConfig,
  getRefexOneSamlSsoUrl,
  parseRefexOneSamlResponse,
  resolveSamlRelayState,
} from '../services/refexOneSamlService.js';

const router = Router();

function signUserToken(authUser) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured on the server');
  }
  return jwt.sign(
    {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      role: authUser.role,
      departmentId: authUser.departmentId,
      departmentName: authUser.departmentName,
      isSuperAdmin: authUser.isSuperAdmin,
    },
    secret,
    { expiresIn: '24h' }
  );
}

async function issueAuthResponse(res, userRow) {
  const authUser = await enrichAuthUser(userRow);
  const token = signUserToken(authUser);
  res.json({ token, user: authUser });
}

function htmlSsoRedirect(targetUrl, p2pToken) {
  const safeUrl = String(targetUrl).replace(/"/g, '&quot;');
  const safeToken = String(p2pToken)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/</g, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${safeUrl}" />
  <title>P2P SSO</title>
</head>
<body>
  <p>Signing you into P2P…</p>
  <script>
    try {
      sessionStorage.setItem('p2p_sso_token', '${safeToken}');
      localStorage.setItem('p2p_sso_token', '${safeToken}');
    } catch (e) {}
    window.location.replace('${safeUrl}');
  </script>
  <p><a href="${safeUrl}">Continue to P2P</a></p>
</body>
</html>`;
}

async function completeSamlLoginAndRedirect(res, userRow, relayState) {
  const authUser = await enrichAuthUser(userRow);
  const token = signUserToken(authUser);
  const { launchUrl, appUrl } = getRefexOneSamlConfig();
  const resolved = resolveSamlRelayState(relayState, appUrl);

  let target;
  try {
    target = new URL(resolved);
  } catch {
    target = new URL(launchUrl);
  }
  if (target.origin !== new URL(appUrl).origin) {
    target = new URL(launchUrl);
  }
  target.searchParams.set('p2p_token', token);

  console.log('[SAML ACS] SSO ok for', authUser.email, '→', target.toString());
  res
    .status(200)
    .type('html')
    .send(htmlSsoRedirect(target.toString(), token));
}

async function loginViaRefexOne(email, password) {
  const refexProfile = await authenticateRefexOne(email, password);
  return resolveLocalUserFromRefexOne(refexProfile);
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [rows] = await pool.query(
      `SELECT u.*, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.email = ? AND u.is_active = 1`,
      [normalizedEmail]
    );

    if (rows.length) {
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (valid) {
        return issueAuthResponse(res, user);
      }

      if (shouldTryRefexOneLogin(user, normalizedEmail)) {
        try {
          const localUser = await loginViaRefexOne(normalizedEmail, password);
          if (localUser) {
            return issueAuthResponse(res, localUser);
          }
        } catch {
          // fall through to invalid credentials
        }
      }

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    try {
      const localUser = await loginViaRefexOne(normalizedEmail, password);
      if (localUser) {
        return issueAuthResponse(res, localUser);
      }
    } catch {
      // fall through
    }

    return res.status(401).json({ message: 'Invalid email or password' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      message: 'Login failed',
      // Helps diagnose Cloud Run / DB misconfig without needing log access
      detail: err.message || String(err),
      code: err.code || undefined,
    });
  }
});

/**
 * SSO: exchange an existing RefexOne access token for a P2P session.
 * Used when user is already signed in at https://refexone.com and returns with a token.
 */
router.post('/refexone', async (req, res) => {
  try {
    const accessToken =
      req.body?.accessToken ||
      req.body?.token ||
      req.body?.access_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (!accessToken) {
      return res.status(400).json({ message: 'RefexOne access token is required' });
    }

    const refexProfile = await authenticateWithRefexOneToken(accessToken);
    const localUser = await resolveLocalUserFromRefexOne(refexProfile);
    if (!localUser) {
      return res.status(401).json({ message: 'Unable to map RefexOne user to P2P' });
    }

    return issueAuthResponse(res, localUser);
  } catch (err) {
    console.error('RefexOne SSO error:', err);
    res.status(401).json({ message: err.message || 'RefexOne sign-in failed' });
  }
});

/**
 * SSO with RefexOne email + password (same credentials as https://refexone.com).
 * Always validates against RefexOne — does not use local demo passwords.
 */
router.post('/refexone/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'RefexOne email and password are required' });
    }

    const localUser = await loginViaRefexOne(email, password);
    if (!localUser) {
      return res.status(401).json({ message: 'Invalid RefexOne email or password' });
    }

    return issueAuthResponse(res, localUser);
  } catch (err) {
    console.error('RefexOne password SSO error:', err);
    res.status(401).json({
      message: err.message || 'Invalid RefexOne email or password',
    });
  }
});

router.get('/refexone/config', (_req, res) => {
  const saml = getRefexOneSamlConfig();
  res.json({
    enabled: process.env.REFEXONE_LOGIN_ENABLED !== 'false',
    refexoneUrl: saml.refexoneUrl,
    /** Set this as HOME URL in RefexOne app launcher */
    launchUrl: saml.launchUrl,
    homeUrl: saml.homeUrl,
    samlAppId: saml.samlAppId || null,
    /** SP-initiated SSO (RelayState defaults to P2P home) */
    ssoUrl: saml.ssoUrl,
    /** Values for RefexOne "Add SAML App" form */
    saml: {
      entityId: saml.entityId,
      acsUrl: saml.acsUrl,
      homeUrl: saml.homeUrl,
      appId: saml.samlAppId || null,
      ssoUrl: saml.ssoUrl,
    },
  });
});

/**
 * Start RefexOne SAML SSO:
 * 302 → https://refexone.com/api/saml/{APP_ID}/sso?RelayState={return_url}
 */
router.get('/refexone/sso', (req, res) => {
  const saml = getRefexOneSamlConfig();
  const returnUrl = resolveSamlRelayState(
    req.query.returnUrl || req.query.RelayState || req.query.redirect,
    saml.appUrl
  );
  const ssoUrl = getRefexOneSamlSsoUrl(returnUrl);
  if (!ssoUrl) {
    return res.redirect(302, saml.refexoneUrl);
  }
  return res.redirect(302, ssoUrl);
});

/**
 * IdP-initiated SAML ACS — RefexOne/Kissflow posts assertion here after user clicks P2P tile.
 * Browser then redirects into P2P already authenticated.
 */
router.post('/refexone/saml/acs', async (req, res) => {
  try {
    const samlResponse = req.body?.SAMLResponse || req.body?.samlResponse;
    const relayState = req.body?.RelayState || req.body?.relayState || req.query?.RelayState;
    console.log(
      '[SAML ACS] POST received',
      'hasSAMLResponse=',
      Boolean(samlResponse),
      'bodyKeys=',
      Object.keys(req.body || {})
    );
    if (!samlResponse) {
      return res.status(400).type('html').send(
        '<h1>SAMLResponse missing</h1><p>RefexOne did not post a SAML assertion to the ACS URL.</p>'
      );
    }

    const profile = await parseRefexOneSamlResponse(samlResponse);
    console.log('[SAML ACS] Parsed profile', profile.email, profile.name);
    const localUser = await resolveLocalUserFromRefexOne(profile);
    if (!localUser) {
      return res.status(401).type('html').send('<h1>Unable to map RefexOne SAML user to P2P</h1>');
    }

    return completeSamlLoginAndRedirect(res, localUser, relayState);
  } catch (err) {
    console.error('RefexOne SAML ACS error:', err);
    const { appUrl, launchUrl } = getRefexOneSamlConfig();
    const fail = new URL(launchUrl || '/auth/refexone/launch', appUrl);
    fail.searchParams.set('error', err.message || 'SAML sign-in failed');
    return res.status(200).type('html').send(
      `<!DOCTYPE html><html><body><script>location.replace(${JSON.stringify(fail.toString())})</script>
       <p>SSO failed: ${String(err.message || 'error')}. <a href="${fail.toString()}">Continue</a></p></body></html>`
    );
  }
});

router.get('/refexone/saml/acs', (_req, res) => {
  const saml = getRefexOneSamlConfig();
  res.type('html').send(`<!DOCTYPE html>
<html><head><title>P2P SAML ACS</title></head>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
  <h1>P2P SAML ACS is ready</h1>
  <p>RefexOne must <strong>POST</strong> a SAMLResponse here when you click the app. A normal browser open (GET) will not log you in.</p>
  <ul>
    <li><strong>Entity ID:</strong> <code>${saml.entityId}</code></li>
    <li><strong>ACS URL:</strong> <code>${saml.acsUrl}</code></li>
    <li><strong>SAML SSO:</strong> <code>${saml.ssoUrl || 'Set REFEXONE_SAML_APP_ID'}</code></li>
  </ul>
  <p>If clicking the app only opens HOME without SSO, keep these ACS/HOME values and ask RefexOne admin to enable IdP-initiated SAML for this app.</p>
</body></html>`);
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.*, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ? AND u.is_active = 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(401).json({ message: 'User not found' });
    const authUser = await enrichAuthUser(rows[0]);
    res.json({ user: authUser });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load user' });
  }
});

export default router;
