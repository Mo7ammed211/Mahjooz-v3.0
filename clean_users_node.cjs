const firebase = require('firebase/app');
require('firebase/auth');
require('firebase/firestore');

// Required for Node.js usage with Firebase v8 Firestore
global.XMLHttpRequest = require("xhr2");

const firebaseConfig = {
  apiKey: "AIzaSyA7ACdMvXQ5xiUIz7QfUbnSA4RcugOdCtM",
  authDomain: "mahjooz-b502f.firebaseapp.com",
  projectId: "mahjooz-b502f",
  storageBucket: "mahjooz-b502f.firebasestorage.app",
  messagingSenderId: "1056495725021",
  appId: "1:1056495725021:web:33a9b2ba7e96e8e288ae34"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

async function cleanUsers() {
  try {
    try {
      await firebase.auth().signInAnonymously();
      console.log('Signed in anonymously');
    } catch(e) {
      console.log('Anonymous sign in failed, trying dummy...', e.message);
      try {
        await firebase.auth().createUserWithEmailAndPassword('admin_cleanup@mahjooz.com', 'cleanup123456');
        console.log('Created dummy user');
      } catch(e2) {
        await firebase.auth().signInWithEmailAndPassword('admin_cleanup@mahjooz.com', 'cleanup123456');
        console.log('Logged in as dummy user');
      }
    }

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
        console.log(`Keeping user: ${name}`);
      }
    }
    console.log(`Total deleted: ${deletedCount}`);
    process.exit(0);
  } catch(e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

cleanUsers();
