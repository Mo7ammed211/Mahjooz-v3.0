const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Navigating to http://localhost:5001...');
  await page.goto('http://localhost:5001', { waitUntil: 'networkidle2' });

  console.log('Executing cleanup script in browser context...');
  await page.evaluate(async () => {
    try {
      // Try to sign in or create a dummy user
      try {
        await firebase.auth().signInAnonymously();
        console.log('Signed in anonymously.');
      } catch (e) {
        console.log('Anonymous sign in failed, trying to create a dummy user...', e.message);
        try {
          await firebase.auth().createUserWithEmailAndPassword('admin_cleanup@mahjooz.com', 'cleanup123456');
          console.log('Created and signed in with dummy user.');
        } catch (e2) {
          if (e2.code === 'auth/email-already-in-use') {
            await firebase.auth().signInWithEmailAndPassword('admin_cleanup@mahjooz.com', 'cleanup123456');
            console.log('Signed in with existing dummy user.');
          } else {
            console.log('Failed to authenticate:', e2.message);
            return;
          }
        }
      }

      console.log('Fetching users collection...');
      const snapshot = await db.collection('users').get();
      let deletedCount = 0;
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const name = data.name || data.fullName || data.displayName || '';
        
        if (name.includes('تجريبي')) {
          console.log(`Deleting user: ${name} (ID: ${doc.id})`);
          await db.collection('users').doc(doc.id).delete();
          deletedCount++;
        } else {
          // console.log(`Keeping user: ${name}`);
        }
      }
      
      console.log(`Cleanup complete. Total deleted: ${deletedCount}`);
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  });

  await browser.close();
  console.log('Done.');
})();
