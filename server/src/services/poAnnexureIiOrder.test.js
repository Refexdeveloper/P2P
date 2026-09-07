import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnexureIiPdfBlocks } from '../templates/poDocumentTemplate.js';

test('Annexure-II is one card per row (no duplicate Continued titles)', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: 'Scope Matrix',
      description:
        '<p>Scope Matrix:</p><table><tr><th>Item</th><th>Qty</th></tr><tr><td>Pump</td><td>1</td></tr></table>',
      images: [{ src: 'data:image/png;base64,aaa', caption: 'A' }],
      comments: '',
    },
  ]);

  assert.equal(blocks.length, 1);
  assert.match(blocks[0].html, /ANNEXURE-II/);
  assert.doesNotMatch(blocks[0].html, /ANNEXURE-II — Continued/);
  assert.match(blocks[0].html, /Scope Matrix/);
  assert.match(blocks[0].html, /<table/i);
  assert.match(blocks[0].html, /Pump/);
});

test('pasted Annexure-II tables stay as HTML text tables', () => {
  const tableHtml = `
    <p>Intro</p>
    <table width="900" style="width:1134px">
      <tr><th>Item</th><th>Qty</th></tr>
      <tr><td>Pump</td><td>1</td></tr>
      <tr><td>Valve</td><td>2</td></tr>
    </table>
  `;

  const blocks = buildAnnexureIiPdfBlocks([
    { header: 'Scope', description: tableHtml, images: [], comments: '' },
  ]);

  assert.equal(blocks.length, 1);
  assert.match(blocks[0].html, /annexure-ii-table/);
  assert.match(blocks[0].html, /Pump/);
  assert.match(blocks[0].html, /Valve/);
  assert.doesNotMatch(blocks[0].html, /width\s*=\s*["']900["']/i);
});
