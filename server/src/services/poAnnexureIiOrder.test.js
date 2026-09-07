import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnexureIiPdfBlocks } from '../templates/poDocumentTemplate.js';

function buildLongTable(rowCount) {
  const header =
    '<tr><th>Sr No.</th><th>Equipment</th><th>Units</th><th>Requirement</th><th>Vendor</th></tr>';
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const n = i + 1;
    return `<tr><td>${n}</td><td>Item ${n}</td><td>-</td><td>Req ${n}</td><td>Val ${n}</td></tr>`;
  }).join('');
  return `<p><strong>Technical specification:</strong></p><table class="annexure-ii-table">${header}${rows}</table>`;
}

test('Annexure-II stays one packed block (no wasteful pre-split pages)', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: '',
      description: buildLongTable(28),
      images: [],
      comments: '',
    },
  ]);

  assert.equal(blocks.length, 1);
  assert.match(blocks[0].html, /ANNEXURE-II/);
  assert.match(blocks[0].html, /Technical specification/);
  assert.match(blocks[0].html, />1</);
  assert.match(blocks[0].html, />28</);
  assert.doesNotMatch(blocks[0].html, /annexure-ii-cont/);
});

test('short Annexure-II table stays on one block', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: '',
      description: buildLongTable(5),
      images: [],
      comments: '',
    },
  ]);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0].html, /ANNEXURE-II/);
});
