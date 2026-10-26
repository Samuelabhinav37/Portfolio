"""Slow a GIF down in place by scaling every frame delay (no re-encode).

usage: python scripts/slow-gif.py FACTOR file.gif [...]
Walks the GIF block structure and rewrites the delay in each Graphic
Control Extension, so palette, transparency and disposal stay untouched.
"""
import sys

def blocks_end(b, i):  # skip a chain of data sub-blocks, return the index after the terminator
    while b[i]:
        i += b[i] + 1
    return i + 1

def slow(b, k):
    b = bytearray(b)
    assert b[:3] == b'GIF', 'not a GIF'
    flags = b[10]
    i = 13 + (3 * 2 ** ((flags & 7) + 1) if flags & 0x80 else 0)  # header + global colour table
    n = 0
    while i < len(b) and b[i] != 0x3B:
        if b[i] == 0x21:                       # extension
            if b[i + 1] == 0xF9:               # graphic control: delay at +4, in 1/100 s
                d = b[i + 4] | b[i + 5] << 8
                d = max(2, min(65535, round(d * k)))
                b[i + 4], b[i + 5] = d & 255, d >> 8
                n += 1
            i = blocks_end(b, i + 2)
        elif b[i] == 0x2C:                     # image: descriptor, local table, LZW data
            f = b[i + 9]
            i += 10 + (3 * 2 ** ((f & 7) + 1) if f & 0x80 else 0)
            i = blocks_end(b, i + 1)
        else:
            raise ValueError('bad block at %d' % i)
    return bytes(b), n

if __name__ == '__main__':
    k = float(sys.argv[1])
    for p in sys.argv[2:]:
        out, n = slow(open(p, 'rb').read(), k)
        open(p, 'wb').write(out)
        print(p, n, 'frames x', k)
