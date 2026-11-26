// One name for the extension API in every browser.
// Firefox and Safari provide `browser`. Chrome and other Chromium browsers provide `chrome`, and in
// Manifest V3 its methods return promises, so the same code works in all of them.
(function (root) {
  root.api = root.browser || root.chrome;
})(globalThis);
