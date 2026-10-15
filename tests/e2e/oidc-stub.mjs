import { createSign, generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.OIDC_PORT ?? '18081');
const host = process.env.OIDC_HOST ?? '127.0.0.1';
const issuer = process.env.OIDC_ISSUER ?? `http://127.0.0.1:${port}`;
const clientId = process.env.OIDC_CLIENT_ID ?? 'e2e-client';
const keyId = 'e2e-key';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' });
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: keyId,
  use: 'sig',
  alg: 'RS256',
};

function json(response, value, status = 200) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
  });
  response.end(body);
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId }));
  const payload = base64Url(
    JSON.stringify({
      iss: issuer,
      sub: 'e2e-user',
      name: 'E2E User',
      preferred_username: 'e2e-user',
      email: 'e2e@example.test',
      azp: clientId,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(privatePem, 'base64url')}`;
}

function body(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, issuer);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    });
    return response.end();
  }
  if (request.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
    return json(response, {
      issuer,
      jwks_uri: `${issuer}/jwks`,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      end_session_endpoint: `${issuer}/logout`,
    });
  }
  if (request.method === 'GET' && url.pathname === '/jwks') {
    return json(response, { keys: [publicJwk] });
  }
  if (request.method === 'GET' && url.pathname === '/auth') {
    const redirect = new URL(url.searchParams.get('redirect_uri'));
    redirect.searchParams.set('code', 'e2e-code');
    redirect.searchParams.set('state', url.searchParams.get('state') ?? '');
    response.writeHead(302, { location: redirect.toString() });
    return response.end();
  }
  if (request.method === 'POST' && url.pathname === '/token') {
    await body(request);
    return json(response, {
      access_token: accessToken(),
      refresh_token: 'e2e-refresh',
      expires_in: 3600,
    });
  }
  if (request.method === 'GET' && url.pathname === '/logout') {
    const redirect = url.searchParams.get('post_logout_redirect_uri');
    if (redirect) {
      response.writeHead(302, { location: redirect });
      return response.end();
    }
  }
  return json(response, { error: 'not found' }, 404);
});

server.listen(port, host, () => {
  process.stdout.write(`OIDC stub listening on ${issuer}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
