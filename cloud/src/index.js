const path = require('node:path');
const { EncryptedFileSyncStore } = require('./encryptedFileSyncStore');
const { createCloudServer } = require('./httpServer');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const port = Number(process.env.PORT || 4319);
const host = process.env.HOST || '127.0.0.1';
const production = process.env.NODE_ENV === 'production';
const publicBaseUrl = production
  ? required('PUBLIC_BASE_URL')
  : process.env.PUBLIC_BASE_URL || `http://${host}:${port}`;
const serviceId = production
  ? required('WALLET_SSO_SERVICE')
  : process.env.WALLET_SSO_SERVICE || 'hns-investments';
if (production && !publicBaseUrl.startsWith('https://')) {
  throw new Error('PUBLIC_BASE_URL must use HTTPS in production.');
}
const store = new EncryptedFileSyncStore({
  filePath: process.env.SYNC_STORAGE_PATH || path.join(process.cwd(), 'cloud-data', 'sync.enc'),
  storageKey: required('SYNC_STORAGE_KEY')
});
const { server } = createCloudServer({
  store,
  config: {
    publicBaseUrl,
    walletAuthorizeUrl: process.env.WALLET_SSO_AUTHORIZE_URL,
    walletExchangeUrl: process.env.WALLET_SSO_EXCHANGE_URL,
    serviceId,
    supportEmail: process.env.SUPPORT_EMAIL,
    cookieSecure: production || publicBaseUrl.startsWith('https://')
  }
});

server.listen(port, host, () => {
  process.stdout.write(`HNS Investments cloud sync listening on ${publicBaseUrl}\n`);
});
