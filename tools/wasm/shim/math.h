#ifndef SHIM_MATH_H
#define SHIM_MATH_H
#define floor __builtin_floor
#define ceil __builtin_ceil
#define sqrt __builtin_sqrt
#define sqrtf __builtin_sqrtf
#define fabs __builtin_fabs
#define fabsf __builtin_fabsf
#define floorf __builtin_floorf
#define ceilf __builtin_ceilf
#define trunc __builtin_trunc
#define fmin __builtin_fmin
#define fmax __builtin_fmax
#define INFINITY __builtin_inff()
#define NAN __builtin_nanf("")
#define HUGE_VAL __builtin_huge_val()
#define M_PI 3.14159265358979323846
#define isnan(x) __builtin_isnan(x)
double sin(double); double cos(double); double exp(double); double pow(double, double);
double log(double); double atan2(double,double); double fmod(double,double); double round(double);
double atan(double); double tan(double);
float sinf(float); float cosf(float);
long lround(double);
#endif
