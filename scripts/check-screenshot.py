#!/usr/bin/env python3
"""Minimal stdlib PNG scanline decoder; reject a mostly-white blank WebView screen."""
import sys,struct,zlib
from pathlib import Path
def nonwhite_fraction(path):
    d=Path(path).read_bytes()
    if d[:8]!=b'\x89PNG\r\n\x1a\n': raise ValueError('Not PNG')
    pos=8; chunks=[]; width=height=bpp=0
    while pos<len(d):
        n=int.from_bytes(d[pos:pos+4],'big'); kind=d[pos+4:pos+8]; chunk=d[pos+8:pos+8+n]; pos+=n+12
        if kind==b'IHDR':
            width,height,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',chunk)
            if depth!=8 or color not in (2,6) or interlace: raise ValueError('Unsupported PNG format')
            bpp=3 if color==2 else 4
        elif kind==b'IDAT':chunks.append(chunk)
        elif kind==b'IEND':break
    if width<100 or height<100:raise ValueError('Invalid screenshot dimensions')
    data=zlib.decompress(b''.join(chunks));rowSize=width*bpp
    i=0;previous=bytearray(rowSize); n=0; colored=0
    for y in range(height):
        f=data[i];i+=1;current=bytearray(data[i:i+rowSize]);i+=rowSize
        for j in range(rowSize):
            left=current[j-bpp] if j>=bpp else 0
            up=previous[j]; ul=previous[j-bpp] if j>=bpp else 0
            if f==0: a=0
            elif f==1:a=left
            elif f==2:a=up
            elif f==3:a=(left+up)//2
            elif f==4:
                p=left+up-ul
                dl,du,dul=abs(p-left),abs(p-up),abs(p-ul)
                a=left if dl<=du and dl<=dul else up if du<=dul else ul
            else: raise ValueError('Unknown PNG filter')
            current[j]=(current[j]+a)&255
        if height//10<=y<height*9//10 and y%32==0:
            for x in range(width//10,width*9//10,32):
                r,g,b=current[x*bpp:x*bpp+3];n+=1
                if min(r,g,b)<235:colored+=1
        previous=current
    return colored/max(1,n)
if __name__=='__main__':
    p=nonwhite_fraction(sys.argv[1]); print(f'M9 UI nonwhite sample ratio: {p:.1%}')
    if p<0.05:
        print('FAIL: blank white screen (app process survived but UI did not render)')
        sys.exit(1)
    print('PASS: nonblank UI visible')
