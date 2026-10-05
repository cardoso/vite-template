import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
 
import { defer } from './defer';
 
// Note: mocks are typed explicitly. An untyped `vi.fn()` returns `any`, which
// matches the async overload and would make `using` a type error.
 
afterEach(() => {
  vi.restoreAllMocks();
});
 
describe('defer', () => {
  describe('with `using`', () => {
    it('runs the callback when the scope exits', () => {
      const log: string[] = [];
 
      {
        using _ = defer(() => log.push('cleanup'));
        log.push('body');
        expect(log).toEqual(['body']); // still inside the block
      }
 
      expect(log).toEqual(['body', 'cleanup']);
    });
 
    it('runs multiple defers in reverse order', () => {
      const log: string[] = [];
 
      {
        using _a = defer(() => log.push('a'));
        using _b = defer(() => log.push('b'));
      }
 
      expect(log).toEqual(['b', 'a']);
    });
 
    it('runs the callback when the body throws', () => {
      const cleanup = vi.fn<() => void>();
 
      expect(() => {
        using _ = defer(cleanup);
        throw new Error('boom');
      }).toThrow('boom');
 
      expect(cleanup).toHaveBeenCalledOnce();
    });
 
    it('propagates errors thrown by the callback', () => {
      expect(() => {
        using _ = defer((): void => {
          throw new Error('cleanup failed');
        });
      }).toThrow('cleanup failed');
    });
 
    it('wraps body and cleanup errors in a SuppressedError', () => {
      const bodyError = new Error('body');
      const cleanupError = new Error('cleanup');
      let caught: unknown;
 
      try {
        using _ = defer((): void => {
          throw cleanupError;
        });
        throw bodyError;
      } catch (error) {
        caught = error;
      }
 
      expect(caught).toBeInstanceOf(SuppressedError);
      expect((caught as SuppressedError).error).toBe(cleanupError);
      expect((caught as SuppressedError).suppressed).toBe(bodyError);
    });
  });
 
  describe('with `await using`', () => {
    it('awaits an async callback before the scope exits', async () => {
      const log: string[] = [];
 
      {
        await using _ = defer(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          log.push('cleanup');
        });
        log.push('body');
        expect(log).toEqual(['body']); // still inside the block
      }
      log.push('after');
 
      expect(log).toEqual(['body', 'cleanup', 'after']);
    });
 
    it('accepts a sync callback', async () => {
      const cleanup = vi.fn<() => void>();
 
      {
        await using _ = defer(cleanup);
        expect(cleanup).not.toHaveBeenCalled();
      }
 
      expect(cleanup).toHaveBeenCalledOnce();
    });
 
    it('propagates rejections from the callback', async () => {
      await expect(async () => {
        await using _ = defer(() => Promise.reject(new Error('async cleanup failed')));
      }).rejects.toThrow('async cleanup failed');
    });
  });
 
  describe('async callback disposed synchronously (misuse)', () => {
    it('throws a TypeError from a real `using` block', () => {
      expect(() => {
        // @ts-expect-error async callbacks require `await using`
        using _ = defer(async () => {});
      }).toThrow(TypeError);
    });
 
    // The remaining tests cast past the overloads to simulate JS callers or
    // `any` leaks, so they can inspect the disposable directly.
 
    it('still invokes the callback', () => {
      const cleanup = vi.fn<() => Promise<void>>(async () => {});
      const disposable = defer(cleanup) as Disposable & AsyncDisposable;
 
      expect(() => disposable[Symbol.dispose]()).toThrow(TypeError);
      expect(cleanup).toHaveBeenCalledOnce();
    });
 
    it('reports a rejection instead of leaving it unhandled', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('async cleanup failed');
      const disposable = defer(() => Promise.reject(error)) as Disposable & AsyncDisposable;
 
      expect(() => disposable[Symbol.dispose]()).toThrow(TypeError);
 
      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith('defer: async cleanup failed', error);
      });
    });
 
    it('detects non-native thenables', () => {
      const thenable = {
        then(onFulfilled: () => void) {
          onFulfilled();
        },
      } as unknown as PromiseLike<void>;
      const disposable = defer(() => thenable) as Disposable & AsyncDisposable;
 
      expect(() => disposable[Symbol.dispose]()).toThrow(TypeError);
    });
  });
 
  describe('idempotency', () => {
    it('runs the callback once across repeated sync disposals', () => {
      const cleanup = vi.fn<() => void>();
      const disposable = defer(cleanup);
 
      disposable[Symbol.dispose]();
      disposable[Symbol.dispose]();
 
      expect(cleanup).toHaveBeenCalledOnce();
    });
 
    it('runs the callback once when disposed both sync and async', async () => {
      const cleanup = vi.fn<() => void>();
      const disposable = defer(cleanup);
 
      disposable[Symbol.dispose]();
      await disposable[Symbol.asyncDispose]();
 
      expect(cleanup).toHaveBeenCalledOnce();
    });
 
    it('does not rerun the callback after a misuse disposal threw', async () => {
      const cleanup = vi.fn<() => Promise<void>>(async () => {});
      const disposable = defer(cleanup) as Disposable & AsyncDisposable;
 
      expect(() => disposable[Symbol.dispose]()).toThrow(TypeError);
      await disposable[Symbol.asyncDispose]();
 
      expect(cleanup).toHaveBeenCalledOnce();
    });
  });
 
  describe('composition with native stacks', () => {
    it('can be adopted by a DisposableStack and moved out of scope', () => {
      const cleanup = vi.fn<() => void>();
      let moved: DisposableStack;
 
      {
        using stack = new DisposableStack();
        stack.use(defer(cleanup));
        moved = stack.move();
      }
 
      expect(cleanup).not.toHaveBeenCalled();
 
      moved.dispose();
 
      expect(cleanup).toHaveBeenCalledOnce();
    });
 
    it('can be adopted by an AsyncDisposableStack', async () => {
      const cleanup = vi.fn<() => Promise<void>>(async () => {});
 
      {
        await using stack = new AsyncDisposableStack();
        stack.use(defer(cleanup));
      }
 
      expect(cleanup).toHaveBeenCalledOnce();
    });
  });
 
  describe('types', () => {
    it('picks the overload based on the callback', () => {
      expectTypeOf(defer(async () => {})).toEqualTypeOf<AsyncDisposable>();
      expectTypeOf(defer(() => {})).toEqualTypeOf<Disposable & AsyncDisposable>();
    });
  });
});