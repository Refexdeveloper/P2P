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
  parseRefexOneSamlResponse,
} from '../services/refexOneSamlService.js';

const router = Router();

function signUserToken(authUser) {
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
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function issueAuthResponse(res, userRow) {
  const authUser = await enrichAuthUser(userRow);
  const token = signUserToken(authUser);
  res.json({ token, user: authUser });
}

async function completeSamlLoginAndRedirect(res, userRow) {
  const authUser = await enrichAuthUser(userRow);
  const token = signUserToken(authUser);
  const { launchUrl, appUrl } = getRefexOneSamlConfig();
  const target = new URL('/auth/refexone/callback', appUrl);
  target.searchParams.set('p2p_token', token);
  // Prefer launch home if callback path unavailable
  const redirectTo = target.toString() || `${launchUrl}?p2p_token=${encodeURIComponent(token)}`;
  return res.redirect(302, redirectTo);
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
    res.status(500).json({ message: 'Login failed' });
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
    /** Values for RefexOne "Add SAML App" form */
    saml: {
      entityId: saml.entityId,
      acsUrl: saml.acsUrl,
      homeUrl: saml.homeUrl,
    },
  });
});

/**
 * IdP-initiated SAML ACS — RefexOne/Kissflow posts assertion here after user clicks P2P tile.
 * Browser then redirects into P2P already authenticated.
 */
router.post('/refexone/saml/acs', async (req, res) => {
  try {
    const samlResponse = req.body?.SAMLResponse || req.body?.samlResponse;
    if (!samlResponse) {
      return res.status(400).send('SAMLResponse missing');
    }

    const profile = await parseRefexOneSamlResponse(samlResponse);
    const localUser = await resolveLocalUserFromRefexOne(profile);
    if (!localUser) {
      return res.status(401).send('Unable to map RefexOne SAML user to P2P');
    }

    return completeSamlLoginAndRedirect(res, localUser);
  } catch (err) {
    console.error('RefexOne SAML ACS error:', err);
    const { appUrl } = getRefexOneSamlConfig();
    const fail = new URL('/auth/refexone/callback', appUrl);
    fail.searchParams.set('error', err.message || 'SAML sign-in failed');
    return res.redirect(302, fail.toString());
  }
});

router.get('/refexone/saml/acs', (_req, res) => {
  const saml = getRefexOneSamlConfig();
  res.json({
    message: 'RefexOne SAML ACS is ready. Configure these values in RefexOne Add SAML App.',
    ...saml,
  });
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
