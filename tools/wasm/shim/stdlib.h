#ifndef SHIM_STDLIB_H
#define SHIM_STDLIB_H
#include <stddef.h>
void *malloc(size_t n);
void *calloc(size_t a, size_t b);
void *realloc(void *p, size_t n);
void free(void *p);
int abs(int x);
long long llabs(long long x);
void qsort(void *base, size_t n, size_t sz, int (*cmp)(const void *, const void *));
#define RAND_MAX 2147483647
#define EXIT_FAILURE 1
void exit(int c);
long long strtoll(const char *s, char **e, int b);
#endif
