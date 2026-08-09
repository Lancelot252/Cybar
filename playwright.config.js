module.exports = {
  testDir: './e2e',
  timeout: 15000,
  fullyParallel: false,
  use: { headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: 'line'
};
