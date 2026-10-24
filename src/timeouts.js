// evaluate() and heavy third-party scripts do not obey locator timeouts.
// Close only this step's pages so remaining checkpoints can still be tested.
export async function withPageDeadline(ms, pages, operation) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Probe deadline exceeded after ${ms} ms; remaining checks are not tested.`,
              ),
            ),
          ms,
        );
      }),
    ]);
  } catch (error) {
    await Promise.all(
      pages()
        .filter(Boolean)
        .map((page) => page.close().catch(() => {})),
    );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
