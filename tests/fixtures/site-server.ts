import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';

export interface FixtureSite {
  port: number;
  origin: string;
  thirdPartyOrigin: string;
  thirdPartyWebSocketOrigin: string;
  close(): Promise<void>;
}

function send(response: ServerResponse, status: number, type: string, body: string, headers: Record<string, string> = {}): void {
  response.writeHead(status, {
    'content-type': type,
    'content-length': String(Buffer.byteLength(body)),
    ...headers,
  });
  response.end(body);
}

export async function startFixtureSite(): Promise<FixtureSite> {
  let port = 0;
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'owned.example'}`);
    if (url.pathname === '/redirect') {
      response.writeHead(302, { location: '/' });
      response.end();
      return;
    }
    if (url.pathname === '/private-redirect') {
      response.writeHead(302, { location: '/blocked' });
      response.end();
      return;
    }
    if (url.pathname === '/slow') {
      setTimeout(() => send(response, 200, 'text/html', '<!doctype html><title>Slow</title>'), 1_500).unref();
      return;
    }
    if (url.pathname === '/large.js') {
      send(response, 200, 'text/javascript', `/* oversized */${'x'.repeat(600_000)}`);
      return;
    }
    if (url.pathname === '/jquery-3.7.1/jquery.min.js') {
      send(response, 200, 'text/javascript', '/*! jQuery v3.7.1 */\nglobalThis.fixtureStaticLoaded = true;');
      return;
    }
    if (url.pathname === '/dynamic.js') {
      send(response, 200, 'text/javascript', 'globalThis.fixtureDynamicLoaded = true;');
      return;
    }
    if (url.pathname === '/worker.js') {
      send(response, 200, 'text/javascript', 'self.close();');
      return;
    }
    if (url.pathname === '/style.css') {
      send(response, 200, 'text/css', 'body { color: #10231c; }');
      return;
    }
    if (url.pathname === '/api/data') {
      send(response, 200, 'application/json', '{"ok":true}');
      return;
    }
    if (url.pathname === '/frame') {
      send(response, 200, 'text/html', '<!doctype html><title>Fixture frame</title>');
      return;
    }
    if (url.pathname === '/popup') {
      send(response, 200, 'text/html', '<!doctype html><title>Fixture popup</title>');
      return;
    }
    if (url.pathname === '/') {
      const thirdPartyOrigin = `http://third-party.example:${port}`;
      const html = `<!doctype html>
        <html lang="en"><head>
          <meta charset="utf-8">
          <meta http-equiv="Content-Security-Policy" content="img-src 'self'">
          <link rel="stylesheet" href="/style.css" integrity="sha384-fixture" crossorigin="anonymous">
          <script src="/jquery-3.7.1/jquery.min.js" integrity="sha384-fixture" crossorigin="anonymous"></script>
          <script src="/large.js"></script>
        </head><body>
          <h1>Authorized fixture</h1>
          <iframe src="/frame" sandbox="allow-scripts"></iframe>
          <form action="/submitted" method="post"><input name="secret" value="never-retained"></form>
          <script>
            const script = document.createElement('script');
            script.src = '${thirdPartyOrigin}/dynamic.js?token=not-retained';
            document.head.append(script);
            fetch('/api/data?account=not-retained');
            new Worker('/worker.js');
            navigator.serviceWorker?.register('/service-worker.js').catch(() => {});
            const socket = new WebSocket('ws://third-party.example:${port}/socket?credential=not-retained');
            socket.addEventListener('open', () => socket.close());
            window.open('/popup', '_blank');
            document.querySelector('form').submit();
          </script>
        </body></html>`;
      send(response, 200, 'text/html', html, {
        'content-security-policy': `default-src 'self'; script-src 'self' 'unsafe-inline' ${thirdPartyOrigin}; connect-src 'self' ws://third-party.example:${port}; object-src 'none'; frame-ancestors 'none'; base-uri 'none'`,
        'content-security-policy-report-only': "default-src 'self'; script-src 'self'",
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'camera=(), microphone=(), geolocation=()',
        'x-content-type-options': 'nosniff',
      });
      return;
    }
    send(response, 404, 'text/plain', 'Not found');
  });
  const websocketServer = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'owned.example'}`);
    if (url.pathname !== '/socket') {
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit('connection', client, request);
    });
  });
  websocketServer.on('connection', (socket) => socket.close());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind to TCP');
  port = address.port;
  return {
    port,
    origin: `http://localhost:${port}`,
    thirdPartyOrigin: `http://third-party.example:${port}`,
    thirdPartyWebSocketOrigin: `ws://third-party.example:${port}`,
    async close() {
      websocketServer.close();
      server.close();
      await once(server, 'close');
    },
  };
}
