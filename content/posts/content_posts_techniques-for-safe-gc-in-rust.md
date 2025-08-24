# Techniques for Safe Garbage Collection in Rust

Rust gives us ownership and lifetimes; building a GC *on top* means embracing
those strengths while carving escape hatches judiciously.

## Approaches

1. **Arena + Index** (store handles)
2. **Tracing with Pin** (pin interior nodes)
3. **Epoch-based** reclamation for global graphs

### Key Insight

Keep unsafe blocks *tiny* and push invariants outward via types.

```rust
pub struct GcHandle<T> {
    idx: u32,
    _marker: PhantomData<T>
}