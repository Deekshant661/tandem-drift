import { createGameServer } from './server.js';

const port = Number(process.env.PORT ?? 8080);
const server = createGameServer();

server.http.listen(port, () => {
  console.log(`tandem-drift server listening on :${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    void server.close().then(() => process.exit(0));
  });
}
