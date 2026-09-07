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

test('Annexure-II long table keeps title once and row order across pages', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: '',
      description: buildLongTable(28),
      images: [],
      comments: '',
    },
  ]);

  assert.ok(blocks.length >= 2, 'expected multiple page chunks for a long table');
  assert.match(blocks[0].html, /ANNEXURE-II/);
  assert.match(blocks[0].html, /Technical specification/);
  assert.match(blocks[0].html, />1</);

  // Later chunks must not repeat the main ANNEXURE-II title bar.
  for (let i = 1; i < blocks.length; i += 1) {
    assert.doesNotMatch(blocks[i].html, /annexure-ii-title/);
    assert.match(blocks[i].html, /annexure-ii-cont/);
  }

  // Row numbers must appear in ascending order across chunks.
  const nums = [];
  for (const block of blocks) {
    const found = [...block.html.matchAll(/<td>(\d+)<\/td>/g)].map((m) => Number(m[1]));
    nums.push(...found);
  }
  const unique = [...new Set(nums)];
  assert.deepEqual(unique, [...unique].sort((a, b) => a - b));
  assert.equal(unique[0], 1);
  assert.equal(unique[unique.length - 1], 28);
});

test('short Annexure-II table stays on one page', () => {
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
  assert.doesNotMatch(blocks[0].html, /annexure-ii-cont/);
});
