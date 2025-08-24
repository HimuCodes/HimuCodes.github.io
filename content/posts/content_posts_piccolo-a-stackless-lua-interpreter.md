# Piccolo — A Stackless Lua Interpreter

Piccolo is a small experimental interpreter exploring *stackless* execution,
incremental continuation passing, and alternative memory layouts.

## Goals

- Reduce interpreter *call overhead*.
- Enable lightweight **instrumentation** hooks (profiling / tracing).
- Support pausable execution for tools.

## High-Level Strategy

1. **Bytecode → micro-ops** flattening
2. **Continuation objects** rather than native stack frames
3. Region-based allocation for short-lived objects

> This is a design journal, not a production release. Expect rough edges.

### Micro Benchmarks

| Test | Baseline | Piccolo | Delta |
|------|----------|---------|-------|
| fib(28) | 1.00x | 0.92x | -8% |
| table walk | 1.00x | 1.05x | +5% |

(Preliminary numbers — cold cache, native target, no JIT)

### Next

- Integrate incremental GC arena
- Evaluate tail-call patterns
- Explore WASM compile targets

*– himu*