import { test, expect } from '@playwright/test';

test('role briefing: cards remain switchable after completion', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    localStorage.setItem(
      'cv_role_briefing',
      JSON.stringify({
        done: true,
        skipped: false,
        activeRole: 'product',
        step: 2,
        quiz: { index: 0, answers: [], correct: 0 }
      })
    );
  });

  // Enter the briefing screen (the home screen click triggers switchScreen()).
  await page.locator('#screen-home').click();

  await expect(page.locator('#cv-role-detail')).toBeVisible();
  await expect(page.locator('#cv-role-quiz')).toBeHidden();

  await page.locator('[data-cv-role="design"]').click();
  await expect(page.locator('#cv-role-detail')).toBeVisible();
  await expect(page.locator('[data-cv-role="design"]')).toHaveClass(/ring-4/);
});

