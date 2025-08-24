# Piccolo — A Stackless Lua Interpreter

*Published on May 1, 2024*

Piccolo is an experimental Lua interpreter that implements stackless execution using continuation-passing style. This approach eliminates the traditional call stack limitations and enables powerful features like unlimited recursion depth and cooperative multitasking.

## Key Features

- **Stackless Execution**: No call stack depth limitations
- **Cooperative Multitasking**: Built-in coroutine support
- **Memory Efficient**: Minimal overhead for function calls
- **Full Lua Compatibility**: Supports Lua 5.4 syntax and semantics

## Implementation Details

The core innovation lies in transforming regular function calls into continuation-passing style:

```lua
function factorial(n)
    if n <= 1 then
        return 1
    else
        return n * factorial(n - 1)
    end
end
```

This becomes internally represented as a series of continuations, allowing the interpreter to pause and resume execution at any point.

## Performance Characteristics

While stackless execution adds some overhead compared to traditional interpreters, the benefits for certain use cases are significant:

- Unlimited recursion depth
- Pausable/resumable execution
- Better memory locality for deep call chains

The project is available on [GitHub](https://github.com/HimuCodes/piccolo) with detailed documentation and examples.
