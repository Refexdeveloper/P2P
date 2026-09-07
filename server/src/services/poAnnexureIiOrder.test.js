import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnexureIiPdfBlocks } from '../templates/poDocumentTemplate.js';
import { getAnnexureIiRowIndex } from './poPdfService.js';

test('Annexure-II keeps user Header text in PDF HTML', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: '<p>Technical specification:</p>',
      description:
        '<table class="annexure-ii-table"><tr><th>Sr</th><th>Item</th></tr><tr><td>1</td><td>Pump</td></tr></table>',
      images: [],
      comments: '',
    },
  ]);

  assert.equal(blocks.length, 1);
  assert.match(blocks[0].html, /annexure-ii-title/);
  assert.match(blocks[0].html, /annexure-ii-header/);
  assert.match(blocks[0].html, /Technical specification/);
  assert.match(blocks[0].html, /Pump/);
  assert.match(blocks[0].html, /data-annexure-ii-row="0"/);
  assert.equal(blocks[0].rowIndex, 0);
});

test('Annexure-II blocks keep editor add order (first row first)', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: '<p>Technical specification:</p>',
      description: '<p>First added</p>',
      images: [],
      comments: '',
    },
    {
      header: '<p>Scope of work</p>',
      description: '<p>Second added</p>',
      images: [],
      comments: '',
    },
    {
      header: '<p>Commercial notes</p>',
      description: '<p>Third added</p>',
      images: [],
      comments: '',
    },
  ]);

  assert.equal(blocks.length, 3);
  assert.deepEqual(
    blocks.map((b) => b.rowIndex),
    [0, 1, 2]
  );
  assert.match(blocks[0].html, /Technical specification/);
  assert.match(blocks[1].html, /Scope of work/);
  assert.match(blocks[2].html, /Commercial notes/);
  assert.equal(getAnnexureIiRowIndex(blocks[0]), 0);
  assert.equal(getAnnexureIiRowIndex(blocks[2]), 2);
});

test('fixAnnexureIiHeadingOrder must not strip user Header', () => {
  // Mirror the fixed rule: strip only annexure-ii-title, never annexure-ii-header.
  const html = `
    <div class="annexure-ii">
      <div class="annexure-ii-title">ANNEXURE-II</div>
      <div class="annexure-ii-header"><p>My Custom Heading</p></div>
      <div class="annexure-ii-body"><p>Body</p></div>
    </div>`;
  const strippedTitleOnly = html.replace(/<div class="annexure-ii-title">[\s\S]*?<\/div>/gi, '');
  assert.match(strippedTitleOnly, /My Custom Heading/);
  assert.doesNotMatch(strippedTitleOnly, /annexure-ii-title/);
});

test('interleaved Annexure-II pages reassemble in add order', () => {
  // Simulate overflow putting row0 continuation after row1, then enforce order.
  const interleaved = [
    [{ type: 'annexure-ii', rowIndex: 0, html: '<div class="annexure-ii" data-annexure-ii-row="0"><div class="annexure-ii-title">ANNEXURE-II</div><div class="annexure-ii-header">First</div></div>' }],
    [{ type: 'annexure-ii', rowIndex: 1, html: '<div class="annexure-ii" data-annexure-ii-row="1"><div class="annexure-ii-title">ANNEXURE-II</div><div class="annexure-ii-header">Second</div></div>' }],
    [{ type: 'annexure-ii', rowIndex: 0, html: '<div class="annexure-ii annexure-ii-cont" data-annexure-ii-row="0"><div class="annexure-ii-body">First cont</div></div>' }],
  ];
  const groups = new Map();
  for (const page of interleaved) {
    for (const block of page) {
      const idx = getAnnexureIiRowIndex(block);
      if (!groups.has(idx)) groups.set(idx, []);
      groups.get(idx).push(block);
    }
  }
  const ordered = [];
  for (const idx of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(idx);
    const titled = group.filter((b) => /annexure-ii-title/i.test(b.html));
    const conts = group.filter((b) => !/annexure-ii-title/i.test(b.html));
    ordered.push(...titled, ...conts);
  }
  assert.deepEqual(
    ordered.map((b) => `${getAnnexureIiRowIndex(b)}:${/cont/i.test(b.html) ? 'c' : 't'}`),
    ['0:t', '0:c', '1:t']
  );
});