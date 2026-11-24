/* Mini libc pour WebAssembly : allocation par arène, quelques fonctions de chaînes. */
#include <stddef.h>
#include <stdint.h>
typedef struct _FILE FILE;
FILE *stdout, *stderr;

extern unsigned char __heap_base;
static size_t heap_top = 0;
static size_t heap_floor = 0;

static void ensure(size_t end) {
    size_t have = (size_t)__builtin_wasm_memory_size(0) * 65536;
    if (end > have) {
        size_t pages = (end - have + 65535) / 65536;
        if (__builtin_wasm_memory_grow(0, pages) == (size_t)-1) __builtin_trap();
    }
}
void *malloc(size_t n) {
    if (!heap_top) { heap_top = ((size_t)&__heap_base + 15) & ~(size_t)15; heap_floor = heap_top; }
    n = (n + 15) & ~(size_t)15;
    size_t p = heap_top;
    ensure(p + n);
    heap_top = p + n;
    return (void *)p;
}
void *calloc(size_t a, size_t b) { void *p = malloc(a * b); __builtin_memset(p, 0, a * b); return p; }
void *realloc(void *p, size_t n) { void *q = malloc(n); if (p) __builtin_memcpy(q, p, n); return q; }
void free(void *p) { (void)p; }
void arena_reset(size_t keep) { heap_top = keep ? keep : heap_floor; }
size_t arena_mark(void) { if (!heap_top) malloc(1); return heap_top; }

void *memset(void *d, int c, size_t n) { unsigned char *p = d; while (n--) *p++ = (unsigned char)c; return d; }
void *memcpy(void *d, const void *s, size_t n) { unsigned char *a = d; const unsigned char *b = s; while (n--) *a++ = *b++; return d; }
void *memmove(void *d, const void *s, size_t n) {
    unsigned char *a = d; const unsigned char *b = s;
    if (a < b) while (n--) *a++ = *b++; else { a += n; b += n; while (n--) *--a = *--b; }
    return d;
}
int memcmp(const void *x, const void *y, size_t n) {
    const unsigned char *a = x, *b = y;
    for (; n; n--, a++, b++) if (*a != *b) return *a - *b;
    return 0;
}
size_t strlen(const char *s) { size_t n = 0; while (s[n]) n++; return n; }
int strcmp(const char *a, const char *b) { while (*a && *a == *b) { a++; b++; } return (unsigned char)*a - (unsigned char)*b; }
int strncmp(const char *a, const char *b, size_t n) { for (; n; n--, a++, b++) { if (*a != *b) return (unsigned char)*a - (unsigned char)*b; if (!*a) break; } return 0; }
char *strcpy(char *d, const char *s) { char *r = d; while ((*d++ = *s++)); return r; }
int abs(int x) { return x < 0 ? -x : x; }
long long llabs(long long x) { return x < 0 ? -x : x; }
void exit(int c) { (void)c; __builtin_trap(); }
int sprintf(char *b, const char *f, ...) { (void)f; b[0] = 0; return 0; }
int snprintf(char *b, size_t n, const char *f, ...) { (void)f; if (n) b[0] = 0; return 0; }
long long strtoll(const char *s, char **e, int b) { (void)s; (void)b; if (e) *e = (char *)s; return 0; }
void qsort(void *base, size_t n, size_t sz, int (*cmp)(const void *, const void *)) {
    unsigned char *a = base, tmp[64];
    if (sz > sizeof tmp) return;
    for (size_t i = 1; i < n; i++) {
        __builtin_memcpy(tmp, a + i * sz, sz);
        size_t j = i;
        while (j > 0 && cmp(a + (j - 1) * sz, tmp) > 0) { __builtin_memcpy(a + j * sz, a + (j - 1) * sz, sz); j--; }
        __builtin_memcpy(a + j * sz, tmp, sz);
    }
}
