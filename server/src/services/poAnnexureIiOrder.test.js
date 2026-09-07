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

test('enforceDocumentSectionOrder moves Annexure-II before sign and acceptance', () => {
  const blocks = buildAnnexureIiPdfBlocks([
    {
      header: '',
      description: '',
      images: [{ src: 'data:image/png;base64,xx' }],
      comments: '',
    },
  ]);

  const broken = [
    [{ type: 'details', html: '<div>details content here</div>' }],
    [{ type: 'notes', html: '<div class="special-notes">SCM SIGN</div>' }],
    [{ type: 'ack', html: '<div class="ack-block">VENDOR ACCEPT</div>' }],
    [{ type: 'annexure-ii', html: blocks[0].html }],
  ];

  const fixed = enforceDocumentSectionOrder(broken);
  const types = fixed.map((page) => page.map((b) => b.type).join('+'));

  const ii = types.findIndex((t) => t.includes('annexure-ii'));
  const notes = types.findIndex((t) => t.includes('notes'));
  const ack = types.findIndex((t) => t.includes('ack'));

  assert.ok(ii >= 0 && notes >= 0 && ack >= 0);
  assert.ok(ii < notes, `expected annexure-ii before notes, got ${types.join(' | ')}`);
  assert.ok(notes < ack, `expected notes before ack, got ${types.join(' | ')}`);
});
