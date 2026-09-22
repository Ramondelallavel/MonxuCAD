#!/usr/bin/env python3
"""Mira una captura del teléfono virtual y dice si la aplicación pintó.

Una ventana en blanco y la aplicación funcionando se distinguen a
simple vista, pero no desde un flujo de trabajo.  Aquí se busca el
botón de aplicación —el cuadro rojo de la esquina, que sólo existe si
la interfaz se ha cargado— y se mira que la pantalla tenga variedad de
color, porque un error pinta un fondo liso.
"""

import struct
import sys
import zlib

ROJO = (0xC0, 0x27, 0x2D)      # el botón de aplicación
TOLERANCIA = 24
MINIMO_ROJO = 300              # píxeles; el botón mide 38 x altura de barra
MINIMO_COLORES = 40


def lee_png(ruta):
    datos = open(ruta, 'rb').read()
    if datos[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit('eso no es un PNG: ' + ruta)
    pos, idat, ancho, alto, prof, tipo, entrelazado = 8, [], 0, 0, 0, 0, 0
    while pos < len(datos):
        largo = struct.unpack('>I', datos[pos:pos + 4])[0]
        marca = datos[pos + 4:pos + 8]
        cuerpo = datos[pos + 8:pos + 8 + largo]
        if marca == b'IHDR':
            ancho, alto, prof, tipo, _, _, entrelazado = struct.unpack('>IIBBBBB', cuerpo[:13])
        elif marca == b'IDAT':
            idat.append(cuerpo)
        elif marca == b'IEND':
            break
        pos += 12 + largo
    if prof != 8 or entrelazado:
        raise SystemExit('captura en un formato que no se sabe leer')
    canales = {0: 1, 2: 3, 4: 2, 6: 4}.get(tipo)
    if canales is None:
        raise SystemExit('captura con paleta, que no se sabe leer')

    crudo = zlib.decompress(b''.join(idat))
    paso, ancho_fila = canales, ancho * canales
    filas, previa, i = [], bytearray(ancho_fila), 0
    for _ in range(alto):
        filtro = crudo[i]; i += 1
        fila = bytearray(crudo[i:i + ancho_fila]); i += ancho_fila
        if filtro == 1:
            for x in range(paso, ancho_fila):
                fila[x] = (fila[x] + fila[x - paso]) & 255
        elif filtro == 2:
            for x in range(ancho_fila):
                fila[x] = (fila[x] + previa[x]) & 255
        elif filtro == 3:
            for x in range(ancho_fila):
                izq = fila[x - paso] if x >= paso else 0
                fila[x] = (fila[x] + ((izq + previa[x]) >> 1)) & 255
        elif filtro == 4:
            for x in range(ancho_fila):
                a = fila[x - paso] if x >= paso else 0
                b = previa[x]
                c = previa[x - paso] if x >= paso else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                fila[x] = (fila[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
        filas.append(fila)
        previa = fila
    return ancho, alto, canales, filas


def main():
    ruta = sys.argv[1] if len(sys.argv) > 1 else 'pantalla.png'
    ancho, alto, canales, filas = lee_png(ruta)

    rojos, colores = 0, set()
    for fila in filas:
        for x in range(0, len(fila), canales):
            r, g, b = fila[x], fila[x + 1] if canales > 2 else fila[x], fila[x + 2] if canales > 2 else fila[x]
            if (abs(r - ROJO[0]) <= TOLERANCIA and abs(g - ROJO[1]) <= TOLERANCIA
                    and abs(b - ROJO[2]) <= TOLERANCIA):
                rojos += 1
            if len(colores) < 4096:
                colores.add((r >> 3, g >> 3, b >> 3))

    print('captura %dx%d | píxeles del botón de aplicación: %d | tonos distintos: %d'
          % (ancho, alto, rojos, len(colores)))

    fallos = []
    if rojos < MINIMO_ROJO:
        fallos.append('no aparece el botón de aplicación: la interfaz no se ha pintado')
    if len(colores) < MINIMO_COLORES:
        fallos.append('la pantalla es casi de un solo color: parece una página de error o vacía')
    if fallos:
        for f in fallos:
            print('FALLO: ' + f)
        return 1
    print('La aplicación se ve en pantalla.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
