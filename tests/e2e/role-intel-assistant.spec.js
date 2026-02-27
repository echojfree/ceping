import { test, expect } from '@playwright/test';

test('role intel assistant: streaming reply renders markdown', async ({ page }) => {
  await page.goto('/');

  // Enter the role briefing screen.
  await page.locator('#screen-home').click();

  const q = page.locator('#cv-role-ai-q');
  const send = page.locator('#cv-role-ai-send');
  const out = page.locator('#cv-role-ai-out');
  const status = page.locator('#cv-role-ai-status');

  await expect(q).toBeVisible();
  await expect(send).toBeVisible();

  await q.fill('给我一个 1 天工作流程（按小时）+ 新手易错点 + 我应该练哪些技能？');
  await send.click();

  await expect(status).toHaveText(/完成|失败/, { timeout: 20_000 });
  await expect(out).toHaveText(/.{30,}/, { timeout: 20_000 });

  // Markdown should result in some structural elements (lists/code/quote).
  const mdEl = page.locator('#cv-role-ai-out ul, #cv-role-ai-out ol, #cv-role-ai-out pre, #cv-role-ai-out blockquote');
  await expect(mdEl.first()).toBeVisible({ timeout: 20_000 });
});

