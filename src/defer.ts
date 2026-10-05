/**
 * Scope-based cleanup helper for explicit resource management.
 *
 * Requires `"lib": ["esnext.disposable"]` (or an equivalent target) in
 * tsconfig.json, plus runtime support for `using` / `await using`.
 */

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null | undefined)?.then === 'function';
}

/**
 * Runs an async cleanup callback when the scope exits. Requires `await using`.
 *
 * @example
 * await using _ = defer(async () => await connection.close());
 */
export function defer(callback: () => PromiseLike<unknown>): AsyncDisposable;

/**
 * Runs a cleanup callback when the scope exits. Works with `using` or `await using`.
 *
 * If the callback turns out to return a promise under sync `using`, a
 * `TypeError` is thrown (and any rejection is still reported), since the
 * promise could not be awaited.
 *
 * @example
 * using _ = defer(() => console.log('Cleaned up'));
 */
export function defer(callback: () => void): Disposable & AsyncDisposable;

export function defer(callback: () => unknown): Disposable & AsyncDisposable {
  let disposed = false;

  return {
    [Symbol.dispose]() {
      if (disposed) return;
      disposed = true;

      const result = callback();

      if (isPromiseLike(result)) {
        // Prevent the floating promise from becoming an unhandled rejection.
        Promise.resolve(result).catch((error: unknown) => {
          console.error('defer: async cleanup failed', error);
        });

        throw new TypeError(
          'defer: an async cleanup callback was disposed with `using`, so it was not awaited. ' +
            'Use `await using` instead.',
        );
      }
    },

    async [Symbol.asyncDispose]() {
      if (disposed) return;
      disposed = true;

      await callback();
    },
  };
}