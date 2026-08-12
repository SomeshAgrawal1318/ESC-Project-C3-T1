import { expect, test } from '@playwright/test';

const USERNAME = 'LiveDemo@DAS';
const ORIGINAL_PASSWORD = 'LiveDemo@123';
const UPDATED_PASSWORD = 'LiveDemo@456';

async function signIn(page, password) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(USERNAME);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function changePassword(page, currentPassword, newPassword) {
  await page.goto('/account');
  await page.getByLabel('Current password').fill(currentPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated.', { exact: true })).toBeVisible();
}

test('live demo: browser upload reaches Gemini and password change persists', async ({ page }, testInfo) => {
  await page.setContent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="500">
      <rect width="100%" height="100%" fill="white"/>
      <text x="55" y="110" font-family="cursive" font-size="42" fill="black">
        Yesterday i goed to the park becos my frend was there.
      </text>
      <text x="55" y="190" font-family="cursive" font-size="42" fill="black">
        We dont recieve many chances to play together
      </text>
    </svg>
  `);
  const uploadPath = testInfo.outputPath('synthetic-writing.png');
  await page.locator('svg').screenshot({ path: uploadPath });

  await signIn(page, ORIGINAL_PASSWORD);
  await page.getByRole('link', { name: /Live Demo Learner/ }).click();
  await page.getByRole('link', { name: 'Upload writing sample' }).click();
  await page.locator('input[type="file"]').setInputFiles(uploadPath);
  await page.getByLabel('Sample title').fill('Live Gemini synthetic writing');
  await page.getByRole('button', { name: 'Analyse sample' }).click();

  await expect(page.getByRole('heading', { name: 'Sample uploaded & analysed' })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole('link', { name: 'Open error report' }).click();
  await expect(page.getByText(/\d+ errors? tagged/)).toBeVisible();
  await expect(page.getByText(/analysed/i).first()).toBeVisible();

  await changePassword(page, ORIGINAL_PASSWORD, UPDATED_PASSWORD);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, UPDATED_PASSWORD);
  await expect(page.getByText('Live Demo Educator').first()).toBeVisible();

  await changePassword(page, UPDATED_PASSWORD, ORIGINAL_PASSWORD);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, ORIGINAL_PASSWORD);
});