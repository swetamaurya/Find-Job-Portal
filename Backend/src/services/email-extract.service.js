const IGNORED_DOMAINS = [
  'linkedin.com', 'licdn.com', 'example.com', 'email.com',
  'yourmail.com', 'xyz.com', 'abc.com', 'test.com',
  'sentry.io', 'w3.org', 'schema.org', 'googleapis.com',
];

function isValidEmail(email) {
  if (email.length < 6 || email.length > 80) return false;
  if (/^(test|example|abc|xyz|info@info|noreply|no-reply|admin@admin)/.test(email)) return false;
  if (!/\.[a-z]{2,10}$/.test(email)) return false;
  if (email.includes('..')) return false;
  return true;
}

function isIgnoredDomain(email) {
  return IGNORED_DOMAINS.some((d) => email.toLowerCase().includes(d));
}

function filterEmails(emails) {
  return emails.filter((e) => isValidEmail(e.email) && !isIgnoredDomain(e.email));
}

module.exports = { IGNORED_DOMAINS, isValidEmail, isIgnoredDomain, filterEmails };
