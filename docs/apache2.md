# HTTPS deployment with Apache2

This setup uses Apache2 on the same Linux host as Docker Compose. Apache terminates HTTPS and forwards the entire site to the app's localhost port. The frontend, `/config.js`, and `/api/` share one public origin. Use a dedicated domain at `/`; deployment under a path such as `/dashboard/` is not covered by this configuration. A containerized or remote proxy needs different networking because `127.0.0.1` refers to its own host or container.

## 1. Configure the application

Point your domain's DNS at the server and obtain a TLS certificate for it. The example uses `dashboard.example.com` and existing Let's Encrypt certificate files; replace those with your domain and certificate paths.

Copy `.env.example` to `.env` if needed, retain your Keycloak and Gemini settings, and set:

```dotenv
APP_PORT=8080
ALLOWED_ORIGINS=https://dashboard.example.com
ALLOWED_HOSTS=dashboard.example.com,localhost,127.0.0.1
PUBLIC_API_BASE_URL=
POSTGRES_PASSWORD=replace-with-a-long-random-password
DATABASE_URL=postgres://dkb_dashboard:replace-with-a-long-random-password@db:5432/dkb_dashboard
```

`APP_PORT` controls the private host port, not the public HTTPS port. Keep `localhost` and `127.0.0.1` in `ALLOWED_HOSTS` for local checks and the container health check. Origins include the scheme; allowed hosts contain hostnames only. Leave `PUBLIC_API_BASE_URL` empty so browser API calls use the public site's origin.

Start the application from the repository directory:

```bash
docker compose up -d --build
```

The Rust service recognizes the `X-Forwarded-Proto: https` header written by the Apache configuration and adds HSTS. The service is bound to the Compose host loopback address, so the proxy is the only public path to that header. Classification rate limiting is scoped to the authenticated subject.

## 2. Configure Keycloak

For the public browser client named by `KEYCLOAK_CLIENT_ID`, enable the standard authorization code flow with PKCE S256 and configure:

| Client setting | Value |
| --- | --- |
| Root URL / Home URL | `https://dashboard.example.com/` |
| Valid redirect URIs | `https://dashboard.example.com/` |
| Valid post logout redirect URIs | `https://dashboard.example.com/` |
| Web origins | `https://dashboard.example.com` |

Keep `KEYCLOAK_ISSUER` set to your realm's public HTTPS issuer URL, reachable from both the browser and container. Keep `KEYCLOAK_AUDIENCE` aligned with the audience configured for your API. The browser returns to the public domain after login and logout.

## 3. Enable the Apache site

On Debian or Ubuntu with Apache2 installed:

```bash
sudo a2enmod proxy proxy_http headers ssl alias
sudo cp docker/apache2.conf.example /etc/apache2/sites-available/dkb-dashboard.conf
sudoedit /etc/apache2/sites-available/dkb-dashboard.conf
```

Replace `dashboard.example.com`, the certificate paths, and both occurrences of backend port `8080` if you chose another `APP_PORT`. Apache does not read the application's `.env`. The certificate files must exist before enabling the HTTPS site. Allow inbound ports 80 and 443 in your host firewall.

```bash
sudo a2ensite dkb-dashboard
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Reload only after the configuration test succeeds. The example redirects HTTP to HTTPS, preserves the public Host header, and replaces incoming forwarding headers before proxying. It assumes Apache is the public-facing proxy; an additional CDN or load balancer requires its own trusted-client-address configuration.

## 4. Verify

```bash
docker compose ps
curl --fail http://127.0.0.1:8080/healthz
curl -I http://dashboard.example.com/
curl --fail -D - https://dashboard.example.com/healthz
```

Use your configured `APP_PORT` in the local check. Confirm that Compose publishes only `127.0.0.1`, HTTP redirects to HTTPS, and the public health response includes `Strict-Transport-Security`. Then open the HTTPS URL and test login, CSV import, and logout. AI classification also needs a valid server-side Gemini key.

If Apache returns **502**, check the container is healthy and the backend port matches `APP_PORT`. For **Invalid host header**, check `ALLOWED_HOSTS` and `ProxyPreserveHost`. For **Keycloak redirect errors**, check the public redirect and logout URLs above. Check `docker compose logs app` and `/var/log/apache2/dkb-dashboard-error.log` for details.

See the official [Apache proxy directives](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html) and [Apache request header directives](https://httpd.apache.org/docs/2.4/mod/mod_headers.html) for the underlying configuration options.
