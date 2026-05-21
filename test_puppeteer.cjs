const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('pageerror', err => {
      console.log('--- PAGE ERROR ---');
      console.log(err.message);
      console.log(err.stack);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('--- CONSOLE ERROR ---');
        console.log(msg.text());
      }
    });

    await page.goto('http://localhost:5000', { waitUntil: 'networkidle2' });
    await browser.close();
    console.log('Test completed.');
  } catch(e) {
    console.error('Puppeteer failed:', e);
  }
})();
