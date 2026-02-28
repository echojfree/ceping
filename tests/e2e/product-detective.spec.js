import { test, expect } from '@playwright/test';

test('product detective flow: finish 4 scenes and show generic report', async ({ page }) => {
  await page.goto('/');
  await page.locator('#screen-home').click();
  await page.getByRole('button', { name: '跳过简报' }).click();

  await page.locator('#cv-product-detective-btn').click();
  await expect(page.locator('#screen-product-detective')).toBeVisible();
  await expect(page.locator('#cv-pd-progress')).toHaveText('SCENE 1/4');

  for (let i = 0; i < 3; i += 1) {
    const options = page.locator('#cv-pd-options button');
    await expect(options.first()).toBeVisible();
    await options.first().click();
    await expect(page.locator('#cv-pd-feedback')).toHaveText(/.{10,}/, { timeout: 10000 });
    await page.locator('#screen-product-detective').getByRole('button', { name: '下一幕' }).click();
  }

  const textareas = page.locator('#cv-pd-options textarea');
  await expect(textareas).toHaveCount(3);
  await textareas.nth(0).fill('宿舍用户更关注一键蒸煮与清洗便利，卖点聚焦“快、稳、好洗”。');
  await textareas.nth(1).fill('CTR、加购率、退款率、异味相关差评占比。');
  await textareas.nth(2).fill('7天AB主图测试，设置对照组，按日追踪评论关键词并复盘。');
  await page.locator('#screen-product-detective').getByRole('button', { name: '提交选品假设' }).click();
  await expect(page.locator('#cv-pd-feedback')).toHaveText(/.{10,}/, { timeout: 10000 });

  await page.locator('#screen-product-detective').getByRole('button', { name: '结算报告' }).click();
  await expect(page.locator('#screen-report-generic')).toBeVisible();
  await expect(page.locator('#cv-generic-role-title')).not.toHaveText('正在生成...');
  await expect(page.locator('#cv-task-link')).toContainText('本次为本地测评结果');
  await expect(page.locator('#cv-skill-bars')).toBeVisible();
});
