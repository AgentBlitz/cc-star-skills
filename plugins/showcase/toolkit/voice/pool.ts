/** At most N tasks in flight at once (PLAN §2.4: three requests at a time). Callers await `run(task)`; the rest queue. */
export function createPool(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];

  const advance = () => {
    if (active >= limit) return;
    const start = queue.shift();
    if (!start) return;
    active++;
    start();
  };

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      queue.push(resolve);
      advance();
    });
    try {
      return await task();
    } finally {
      active--;
      advance();
    }
  };
}
