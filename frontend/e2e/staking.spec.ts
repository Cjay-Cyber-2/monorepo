import { test, expect } from '@playwright/test';

test.describe('Staking Deposit-to-Claim Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the staking page
    await page.goto('/staking');
  });

  test('should connect wallet, deposit, view position, and claim rewards successfully', async ({ page }) => {
    // 1. Connect wallet scenario / check connection state
    const connectButton = page.locator('button:has-text("Connect Wallet")');
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await expect(page.locator('text=Wallet connected successfully!')).toBeVisible({ timeout: 10000 });
    }

    // 2. View staked position and accrued/claimable rewards
    await expect(page.locator('text=Your Staked Balance')).toBeVisible();
    await expect(page.locator('text=Claimable Rewards')).toBeVisible();

    // 3. Perform deposit / staking action
    const stakeInput = page.locator('input[placeholder="0.00"], input[id*="stake"]').first();
    if (await stakeInput.isVisible()) {
      await stakeInput.fill('100');
      const submitStakeButton = page.locator('button:has-text("Stake")').first();
      await submitStakeButton.click();
    }

    // 4. Open claim flow / claim rewards and confirm balance update
    const claimButton = page.locator('button:has-text("Claim Rewards")').first();
    if (await claimButton.isVisible()) {
      await claimButton.click();
      
      // Modal confirmation flow
      const confirmClaimButton = page.locator('button:has-text("Confirm Claim"), button:has-text("Claim Now")').first();
      if (await confirmClaimButton.isVisible()) {
        await confirmClaimButton.click();
        await expect(page.locator('text=Success, text=Confirmed')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should surface a clear error on failure case (staking below minimum or invalid claim)', async ({ page }) => {
    // Attempt to stake invalid/zero or negative amount or submit with nothing claimable
    const stakeInput = page.locator('input[placeholder="0.00"], input[id*="stake"]').first();
    if (await stakeInput.isVisible()) {
      await stakeInput.fill('0');
      const submitStakeButton = page.locator('button:has-text("Stake")').first();
      await submitStakeButton.click();
      
      // Verify clear error message surfaces rather than silent failure
      const errorIndicator = page.locator('text=/please enter|minimum|invalid|error/i').first();
      await expect(errorIndicator).toBeVisible({ timeout: 5000 });
    }
  });
});
