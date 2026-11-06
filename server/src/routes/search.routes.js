import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { globalSearch } from '../services/globalSearchService.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || req.query.search || '').trim();
    if (q.length < 1) {
      return res.json({ data: { query: '', prs: [], pos: [] } });
    }
    const data = await globalSearch(req.user, q, {
      limit: req.query.limit,
    });
    res.json({ data });
  } catch (err) {
    console.error('Global search failed:', err.message);
    res.status(500).json({ message: err.message || 'Search failed' });
  }
});

export default router;
