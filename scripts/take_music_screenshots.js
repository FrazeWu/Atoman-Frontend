const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const screenshotDir = '/root/.gemini/antigravity-cli/brain/88c51d22-39ca-4c6a-88ca-011fec960304/scratch/screenshots';

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log('Logging in...');
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('输入用户名或邮箱').fill('admin');
  await page.getByPlaceholder('输入密码').fill('admin123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('http://localhost:5173/');
  console.log('Login successful.');

  // 1. Explore View
  console.log('Capturing Explore page...');
  await page.goto('http://localhost:5173/music');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(screenshotDir, 'music_explore.png') });

  // 2. Play Song (to show player)
  console.log('Playing a song to show audio player...');
  const playBtn = page.getByRole('button', { name: '▶ 播放' }).first();
  if (await playBtn.isVisible()) {
    await playBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, 'music_with_player.png') });
  }

  // 3. Album details (click on first card)
  console.log('Opening album details...');
  const card = page.locator('[data-testid="album-card"]').first();
  if (await card.isVisible()) {
    await card.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, 'music_album_detail.png') });
  }

  // 4. Artists page
  console.log('Capturing Artists page...');
  await page.goto('http://localhost:5173/music/artists');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, 'music_artists.png') });

  // 5. Starred page
  console.log('Capturing Starred page...');
  await page.goto('http://localhost:5173/music/starred');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, 'music_starred.png') });

  // 6. History page
  console.log('Capturing History page...');
  await page.goto('http://localhost:5173/music/history');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, 'music_history.png') });

  // 7. New Artist Edit Drawer
  console.log('Opening New Artist Form...');
  await page.goto('http://localhost:5173/music/artist/new');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(screenshotDir, 'music_new_artist_drawer.png') });

  await browser.close();
  console.log('Screenshots captured successfully.');
}

run().catch(err => {
  console.error('Error taking screenshots:', err);
  process.exit(1);
});
