import fs from 'fs';
import path from 'path';
import { Page, TestInfo } from '@playwright/test';

const SCREENSHOT_ROOT = path.resolve(__dirname, '../screenshots');

export async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  label: string
): Promise<string> {
  const safe = label.replace(/[^\w.-]+/g, '_');
  const dir = path.join(SCREENSHOT_ROOT, testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safe}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(label, { path: file, contentType: 'image/png' });
  return file;
}

export function ensureScreenshotDirs(): void {
  fs.mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(SCREENSHOT_ROOT, '.gitkeep'), '');
}
