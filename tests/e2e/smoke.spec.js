import { test, expect } from '@playwright/test';

test('quiz flow: complete and show report', async ({ page }) => {
  await page.goto('/quiz');
  await expect(page.getByText('快速兴趣测评（RIASEC）')).toBeVisible();

  // Answer all questions with a neutral option (第三个按钮：一般)
  for (let i = 0; i < 36; i += 1) {
    const buttons = page.locator('#options button');
    await expect(buttons).toHaveCount(5);
    await buttons.nth(2).click();
    await page.getByRole('button', { name: i === 35 ? '提交并生成报告' : '下一题' }).click();
  }

  await expect(page.locator('#view-result')).toBeVisible();
  await expect(page.locator('#code')).toHaveText(/[RIASEC]{3}/);
  await expect(page.locator('#qr')).toHaveAttribute('src', /\/api\/results\//);
});

test('admin flow: login and see overview', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('管理员登录')).toBeVisible();

  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('heading', { name: '测评模块' })).toBeVisible();
  await expect(page.locator('#stat-assessments')).not.toHaveText('-');
});

test('prototype flow: choose scenario and generate generic report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /点击开启商战/ }).click();
  await expect(page.getByText('入场前：岗位情报简报')).toBeVisible();
  await page.getByRole('button', { name: '跳过简报' }).click();

  // go to creative deep scenario via "创意先锋阵列"
  await page.locator('#cv-card-creative').click();
  await expect(page.getByText(/CREATIVE_LAB/)).toBeVisible();

  for (let i = 0; i < 6; i += 1) {
    const fillTask = page.locator('#cv-cre-options [data-cv-task=\"fill\"]');
    const dragTask = page.locator('#cv-cre-options [data-cv-task=\"drag\"]');
    if (await fillTask.isVisible()) {
      const input = page.locator('#cv-cre-options input').first();
      await input.fill('测试');
      await page.getByRole('button', { name: '提交本幕文本' }).click();
    } else if (await dragTask.isVisible()) {
      await page.getByRole('button', { name: '提交本幕排序' }).click();
    } else {
      const options = page.locator('#cv-cre-options button');
      await expect(options.first()).toBeVisible();
      await options.first().click();
    }
    // Feedback should be enriched by instant evaluation (not just a placeholder label).
    await expect(page.locator('#cv-cre-feedback')).toHaveText(/.{10,}/, { timeout: 15000 });

    await page
      .locator('#screen-creative-lab')
      .getByRole('button', { name: i === 5 ? '结算报告' : '下一幕' })
      .click();
  }

  // report should show generated role title instead of placeholder
  await expect(page.locator('#screen-report-generic')).toBeVisible();
  await expect(page.locator('#cv-generic-role-title')).not.toHaveText('正在生成...');
  await expect(page.locator('#cv-skill-bars')).toBeVisible();
});

test('frontline flow: complete 6 scenes and show report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /点击开启商战/ }).click();
  await page.getByRole('button', { name: '跳过简报' }).click();

  await page.locator('#cv-card-frontline').click();
  await expect(page.getByText(/FRONTLINE/)).toBeVisible();

  for (let i = 0; i < 6; i += 1) {
    const fillTask = page.locator('#cv-fr-options [data-cv-task=\"fill\"]');
    const dragTask = page.locator('#cv-fr-options [data-cv-task=\"drag\"]');
    if (await fillTask.isVisible()) {
      const inputs = page.locator('#cv-fr-options input');
      await inputs.nth(0).fill('抱歉让你久等了');
      await inputs.nth(1).fill('我这边立刻帮你处理');
      await inputs.nth(2).fill('今晚8点前给你结果');
      await page.getByRole('button', { name: '提交本幕文本' }).click();
    } else if (await dragTask.isVisible()) {
      await page.getByRole('button', { name: '提交本幕排序' }).click();
    } else {
      const options = page.locator('#cv-fr-options button');
      await expect(options.first()).toBeVisible();
      await options.first().click();
    }

    await expect(page.locator('#cv-fr-feedback')).toHaveText(/.{10,}/, { timeout: 15000 });

    await page
      .locator('#screen-frontline')
      .getByRole('button', { name: i === 5 ? '结算报告' : '下一幕' })
      .click();
  }

  await expect(page.locator('#screen-report-generic')).toBeVisible();
  await expect(page.locator('#cv-skill-bars')).toBeVisible();
});

test('data ops flow: complete 6 scenes and show report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /点击开启商战/ }).click();
  await page.getByRole('button', { name: '跳过简报' }).click();

  await page.locator('#cv-card-dataops').click();
  await expect(page.locator('#screen-boot')).toBeVisible();
  await expect(page.getByRole('button', { name: /INITIALIZE/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /INITIALIZE/ }).click();

  // Wait for crisis to trigger and first prompt to appear
  await expect(page.locator('#cv-dataops-prompt')).toContainText('第 1/6 幕', { timeout: 15000 });

  for (let i = 1; i <= 6; i += 1) {
    const cmdInput = page.locator('#cv-dataops-cmd');
    const commitBtn = page.getByRole('button', { name: 'COMMIT' });
    const runBtn = page.getByRole('button', { name: 'RUN' });

    if (await cmdInput.isVisible()) {
      await cmdInput.fill(i >= 5 ? 'guardrail.stoploss --apply' : 'analyze.funnel --by=channel');
      await runBtn.click();
    } else if (await commitBtn.isVisible()) {
      await commitBtn.click();
    } else {
      const buttons = page.locator('#action-buttons button');
      await expect(buttons.first()).toBeVisible();
      await buttons.first().click();
    }

    await expect(page.locator('#cv-dataops-feedback')).toHaveText(/.{10,}/, { timeout: 20000 });

    if (i < 6) {
      await expect(page.locator('#cv-dataops-prompt')).toContainText(`第 ${i + 1}/6 幕`, { timeout: 15000 });
    }
  }

  await expect(page.locator('#screen-report-data')).toBeVisible();
  await expect(page.locator('#report-typing-area')).not.toBeEmpty();
  await expect(page.locator('#cv-skill-bars-data')).toContainText(/\d|（本模块暂无技能数据）/, { timeout: 15000 });
});
