#ifndef SHIM_STDIO_H
#define SHIM_STDIO_H
#include <stddef.h>
typedef struct _FILE FILE;
extern FILE *stdout, *stderr;
#define printf(...) ((void)0)
#define fprintf(...) ((void)0)
#define fflush(x) ((void)0)
#define puts(x) ((void)0)
int sprintf(char *b, const char *f, ...);
int snprintf(char *b, size_t n, const char *f, ...);
#endif
