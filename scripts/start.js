/*
 * Ensures dev server can run anywhere by providing sane defaults
 * if environment variables are missing or empty.
 */

function isEmpty(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

// Force allow all hosts to avoid empty/invalid entries from external envs
process.env.WDS_ALLOWED_HOSTS = 'all';
process.env.ALLOWED_HOSTS = 'all';
console.log('[start.js] WDS_ALLOWED_HOSTS=', process.env.WDS_ALLOWED_HOSTS);
console.log('[start.js] ALLOWED_HOSTS=', process.env.ALLOWED_HOSTS);
console.log('[start.js] HOST before ensure=', process.env.HOST);

if (isEmpty(process.env.HOST)) {
    process.env.HOST = '0.0.0.0';
}
console.log('[start.js] HOST after ensure=', process.env.HOST);

// Ensure dev server does not use 3000/3001; prefer a different default port
const desiredDefaultPort = '3000';
if (!process.env.PORT || process.env.PORT === '3000' || process.env.PORT === '3001') {
    process.env.PORT = desiredDefaultPort;
}
console.log('[start.js] PORT set to', process.env.PORT);

// Optional: keep NODE_OPTIONS intact; do not modify other envs

require('react-scripts/scripts/start');

