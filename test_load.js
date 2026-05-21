const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, {
  url: "http://localhost:5000",
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true
});

dom.window.onerror = function(msg, url, line, col, error) {
  console.log("JSDOM GLOBAL ERROR:");
  console.log(msg);
  if (error) console.log(error.stack);
};

// Also listen to virtual console
dom.window.console.error = function() {
  console.log("JSDOM CONSOLE ERROR:");
  console.log.apply(console, arguments);
};

setTimeout(() => {
  console.log("Done waiting for JSDOM");
}, 3000);
