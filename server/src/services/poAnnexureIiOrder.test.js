import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnexureIiPdfBlocks } from '../templates/poDocumentTemplate.js';

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
