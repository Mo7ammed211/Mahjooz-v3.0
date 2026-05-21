const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse JSON: " + data));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const collections = ['service_sections'];
  for (const col of collections) {
    try {
      const data = await fetchUrl(`https://firestore.googleapis.com/v1/projects/mahjooz-b502f/databases/(default)/documents/${col}`);
      console.log(`\n=== ${col.toUpperCase()} ===`);
      if (data.documents) {
        data.documents.forEach(doc => {
          const fields = doc.fields;
          console.log({
            id: doc.name.split('/').pop(),
            name: fields.name?.stringValue,
            catId: fields.catId?.stringValue || undefined
          });
        });
      } else {
        console.log(`No documents in ${col}`);
      }
    } catch (err) {
      console.error(`Error fetching ${col}:`, err.message);
    }
  }
}
run();
