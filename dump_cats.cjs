const firebase = require('firebase/app');
require('firebase/auth');
require('firebase/firestore');
global.XMLHttpRequest = require("xhr2");

const firebaseConfig = {
  apiKey: "AIzaSyA7ACdMvXQ5xiUIz7QfUbnSA4RcugOdCtM",
  authDomain: "mahjooz-b502f.firebaseapp.com",
  projectId: "mahjooz-b502f",
  storageBucket: "mahjooz-b502f.firebasestorage.app"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

async function checkData() {
  try {
    try {
      await firebase.auth().signInAnonymously();
    } catch(e) {
      await firebase.auth().signInWithEmailAndPassword('admin_cleanup@mahjooz.com', 'cleanup123456');
    }
  } catch(e) {
    console.error('Auth error', e);
  }

  const snapshot = await db.collection('catalog_cats').get();
  const cats = [];
  snapshot.forEach(doc => cats.push({ id: doc.id, ...doc.data() }));
  console.log(JSON.stringify(cats, null, 2));
  process.exit(0);
}
checkData();
