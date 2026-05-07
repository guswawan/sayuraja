import { test, expect } from '@playwright/test';

test.describe('Sayuraja App', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the products API
    await page.route('**/api/products', async route => {
      const json = {
        success: true,
        products: [
          {
            id: '1',
            name: 'Kangkung Segar',
            category: 'Sayuran',
            price: 5000,
            unit: 'ikat',
            stock: 'In Stock',
            image: 'https://ui-avatars.com/api/?name=Kangkung'
          },
          {
            id: '2',
            name: 'Wortel Madu',
            category: 'Sayuran',
            price: 12000,
            unit: '500g',
            stock: 'In Stock',
            image: 'https://ui-avatars.com/api/?name=Wortel'
          }
        ]
      };
      await route.fulfill({ json });
    });

    await page.goto('/');
  });

  test('should display the app title and products', async ({ page }) => {
    await expect(page.getByText('Sayuraja', { exact: true })).toBeVisible();
    await expect(page.getByText('Kangkung Segar')).toBeVisible();
    await expect(page.getByText('Wortel Madu')).toBeVisible();
  });

  test('should allow selecting products and showing the order bar', async ({ page }) => {
    // Click on a product card
    await page.getByText('Kangkung Segar').click();

    // Check if the floating order bar appears
    const orderBar = page.locator('div').filter({ hasText: /1 item dipilih/ });
    await expect(orderBar).toBeVisible();

    // Check if the price is correct (Rp 5.000)
    await expect(page.getByText('Total: Rp 5.000')).toBeVisible();

    // Click on another product
    await page.getByText('Wortel Madu').click();
    await expect(page.getByText('2 item dipilih')).toBeVisible();
    await expect(page.getByText('Total: Rp 17.000')).toBeVisible();
  });

  test('should open and close the chat widget', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Tanya stok, harga...');
    await expect(chatInput).toBeVisible();

    // Type something and press Enter to open chat
    await chatInput.fill('Halo Sayuraja');
    await chatInput.press('Enter');

    // Check if chat card header is visible
    await expect(page.getByText('Asisten Sayuraja')).toBeVisible();

    // Close chat
    await page.locator('button').filter({ has: page.locator('svg.lucide-x') }).click();
    await expect(page.getByText('Asisten Sayuraja')).not.toBeVisible();
    await expect(page.getByPlaceholder('Tanya stok, harga...')).toBeVisible();
  });
});
