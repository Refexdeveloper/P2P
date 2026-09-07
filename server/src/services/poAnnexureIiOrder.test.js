import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnexureIiPdfBlocks } from '../templates/poDocumentTemplate.js';

function pageHasContent(blocks) {
  for (const block of blocks || []) {
    if (block.html != null) {
      const html = String(block.html || '');
      if (/<img\b/i.test(html) || /<figure\b/i.test(html)) return true;
      const text = html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 4) return true;
    } else if (block.rows?.length) {
      return true;
    }
  }
  return false;
}

function enforceDocumentSectionOrder(pages) {
  const early = [];
  const annexureIi = [];
  const notes = [];
  const ack = [];

  for (const page of pages) {
    const earlyPage = [];
    for (const block of page || []) {
      const t = block?.type;
      if (
        t === 'annexure-ii' ||
        (block.html && /class\s*=\s*["'][^"']*annexure-ii/i.test(String(block.html)))
      ) {
        annexureIi.push({ ...block, type: 'annexure-ii' });
      } else if (t === 'notes') notes.push(block);
      else if (t === 'ack') ack.push(block);
      else earlyPage.push(block);
    }
    if (earlyPage.length && pageHasContent(earlyPage)) early.push(earlyPage);
  }

  const out = [...early];
  for (const block of annexureIi) out.push([block]);
  if (notes.length) out.push(notes);
  if (ack.length) out.push(ack);
  return out.filter(pageHasContent);
}

test('Annexure-II images become separate blocks before notes/ack', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: 'Spec',
      description: '<p>Body text</p>',
      images: [
        { src: 'data:image/png;base64,aaa', caption: 'A' },
        { src: 'data:image/png;base64,bbb', caption: 'B' },
      ],
      comments: '',
    },
  ]);

  assert.equal(blocks.length, 3);
  assert.match(blocks[0].html, /Body text/);
  assert.doesNotMatch(blocks[0].html, /annexure-figure/);
  assert.match(blocks[1].html, /annexure-figure/);
  assert.match(blocks[2].html, /annexure-figure/);
});

test('pasted Annexure-II tables stay whole (alignment) and before notes order', () => {
  const tableHtml = `
    <p>Intro</p>
    <table width="900" style="width:1134px">
      <tr><th>Item</th><th>Qty</th></tr>
      <tr><td>Pump</td><td><img src="data:image/png;base64,xx" /></td></tr>
      <tr><td>Valve</td><td>2</td></tr>
    </table>
    <p>After</p>
  `;

  const blocks = buildAnnexureIiPdfBlocks([
    { header: 'Scope', description: tableHtml, images: [], comments: '' },
  ]);

  assert.ok(blocks.length >= 1);
  const tableBlock = blocks.find((b) => /<table/i.test(b.html));
  assert.ok(tableBlock, 'expected a table block');
  assert.match(tableBlock.html, /annexure-ii-table/);
  assert.match(tableBlock.html, /Pump/);
  assert.match(tableBlock.html, /Valve/);
  // Image inside the table must not split the table apart.
  assert.match(tableBlock.html, /<img\b/i);
  assert.doesNotMatch(tableBlock.html, /width\s*=\s*["']900["']/i);
});
