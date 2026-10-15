const endpoint = process.argv[2];

if (!endpoint) {
  throw new Error('token endpoint is required');
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: 'deployment-code',
  }),
});

if (!response.ok) {
  throw new Error(`token request failed: ${response.status}`);
}

const payload = await response.json();
if (typeof payload.access_token !== 'string') {
  throw new Error('token response has no access token');
}

process.stdout.write(payload.access_token);
