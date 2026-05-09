const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Launching browser. Solve the CAPTCHA and log in fully.');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://sso.botpress.cloud/login');

  // We wait for the "Workspaces" text to appear on the screen, indicating success.
  // Timeout is set to 0 (will not time out).
  console.log('Waiting for successful login detection...');
  await page.waitForSelector('text=Workspaces', { timeout: 0 }); 

  console.log('✅ Login detected! Saving session...');
  await context.storageState({ path: 'auth.json' });
  
  console.log('✨ auth.json created successfully. You can now close the browser.');
  await browser.close();
})();
