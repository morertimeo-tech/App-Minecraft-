/* Interface WebAssembly de Grimoire pour la bibliothèque cubiomes (MIT, Cubitect). */
#include "cubiomes/generator.h"
#include "cubiomes/finders.h"
#include "cubiomes/util.h"
#include <stdlib.h>

#define EXPORT __attribute__((visibility("default")))

static Generator G;
static int MC = 0, DIM = 0;
static size_t base_mark = 0;
extern size_t arena_mark(void);
extern void arena_reset(size_t keep);

static int OUT[4096];
EXPORT int *world_out(void) { return OUT; }
EXPORT int mc_newest(void) { return MC_NEWEST; }

EXPORT int world_init(int mc, unsigned lo, unsigned hi, int dim, int large) {
    if (!base_mark) base_mark = arena_mark();
    arena_reset(base_mark);
    MC = mc; DIM = dim;
    setupGenerator(&G, mc, large ? LARGE_BIOMES : 0);
    applySeed(&G, dim, ((uint64_t)hi << 32) | (uint64_t)lo);
    return 0;
}

/* Biomes d'une zone (échelle 1, 4, 16, 64 ou 256). Retourne un tampon d'entiers w*h. */
EXPORT int *world_biomes(int scale, int x, int z, int w, int h, int y) {
    static int *buf = 0; static size_t cap = 0;
    Range r; r.scale = scale; r.x = x; r.z = z; r.sx = w; r.sz = h;
    r.y = y; r.sy = 1;
    size_t need = getMinCacheSize(&G, scale, w, 1, h);
    if (need > cap) { buf = (int *)malloc(need * sizeof(int)); cap = need; }
    if (genBiomes(&G, buf, r) != 0) return 0;
    return buf;
}

/* Dézoom au-delà de l'échelle 256 : un échantillon tous les `stride` cellules de 256 blocs. */
EXPORT int *world_biomes_sparse(int stride, int x, int z, int w, int h, int y) {
    static int *buf = 0; static size_t cap = 0; static int *tmp = 0;
    size_t n = (size_t)w * (size_t)h;
    if (n > cap) { buf = (int *)malloc(n * sizeof(int)); cap = n; }
    if (!tmp) tmp = (int *)malloc(getMinCacheSize(&G, 256, 1, 1, 1) * sizeof(int) + 64);
    Range r; r.scale = 256; r.sx = 1; r.sz = 1; r.y = y; r.sy = 1;
    for (int j = 0; j < h; j++)
        for (int i = 0; i < w; i++) {
            r.x = (x + i) * stride; r.z = (z + j) * stride;
            buf[j * w + i] = genBiomes(&G, tmp, r) == 0 ? tmp[0] : 0;
        }
    return buf;
}

EXPORT int world_biome_at(int x, int z, int y) { return getBiomeAt(&G, 1, x, y, z); }

EXPORT int struct_supported(int type) { StructureConfig c; return getStructureConfig(type, MC, &c); }
EXPORT int struct_region(int type) { StructureConfig c; return getStructureConfig(type, MC, &c) ? c.regionSize * 16 : 0; }
EXPORT int struct_dim(int type) { StructureConfig c; return getStructureConfig(type, MC, &c) ? c.dim : 99; }

/* Structures dans [x0,x1]x[z0,z1] (blocs). Écrit des paires x,z ; retourne leur nombre. */
EXPORT int world_structs(int type, int x0, int z0, int x1, int z1, int *out, int max) {
    StructureConfig c;
    if (!getStructureConfig(type, MC, &c)) return 0;
    if (c.dim != DIM) return 0;
    int reg = c.regionSize * 16;
    int rx0 = (int)floor((double)x0 / reg) - 1, rx1 = (int)floor((double)x1 / reg) + 1;
    int rz0 = (int)floor((double)z0 / reg) - 1, rz1 = (int)floor((double)z1 / reg) + 1;
    int n = 0;
    for (int rz = rz0; rz <= rz1; rz++)
        for (int rx = rx0; rx <= rx1; rx++) {
            Pos p;
            if (!getStructurePos(type, MC, G.seed, rx, rz, &p)) continue;
            if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
            if (!isViableStructurePos(type, &G, p.x, p.z, 0)) continue;
            if (n < max) { out[2 * n] = p.x; out[2 * n + 1] = p.z; }
            n++;
        }
    return n < max ? n : max;
}

/* Forteresses (Overworld) : les `count` premières. */
EXPORT int world_strongholds(int count, int *out) {
    StrongholdIter sh;
    initFirstStronghold(&sh, MC, G.seed);
    int n = 0;
    while (n < count) {
        if (nextStronghold(&sh, &G) <= 0) break;
        out[2 * n] = sh.pos.x; out[2 * n + 1] = sh.pos.z; n++;
    }
    return n;
}

EXPORT int world_spawn(int *out) { Pos p = getSpawn(&G); out[0] = p.x; out[1] = p.z; return 1; }

EXPORT int world_slime(unsigned lo, unsigned hi, int cx, int cz) {
    return isSlimeChunk(((uint64_t)hi << 32) | lo, cx, cz);
}

EXPORT const char *biome_name(int id) { return biome2str(MC, id); }
EXPORT unsigned char *biome_colors(void) { static unsigned char c[256][3]; initBiomeColors(c); return &c[0][0]; }
