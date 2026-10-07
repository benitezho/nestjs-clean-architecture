export default async function globalTeardown(): Promise<void> {
  await globalThis.__PG_CONTAINER__?.stop();
}
