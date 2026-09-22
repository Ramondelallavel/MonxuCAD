# Pruebas del dibujo 2D

Ejecutan los comandos **de verdad** —a través del mismo motor que usa
la aplicación, designando objetos como lo hace el lienzo— y comprueban
la geometría que sale. No son pruebas de unidades sueltas: si una pasa,
es que ese comando dibuja bien.

```bash
cd pruebas
npm install
npx playwright install chromium     # sólo la primera vez
npm test
```

El lanzador levanta él mismo un servidor sobre `web/`, así que no hace
falta preparar nada más. Para usar un Chromium que ya se tenga:

```bash
MONXU_NAVEGADOR=/ruta/al/chrome npm test
```

## Qué cubre

| Suite | Qué comprueba |
|---|---|
| `d2d-dibujo.mjs` | LINEA con coordenadas absolutas, relativas y polares; CIRCULO por centro, por 2P y por 3P; RECTANG; POLIGONO; ARCO por tres puntos; ELIPSE; POL abierta y cerrada; PUNTO |
| `d2d-modificar.mjs` | DESFASE de línea y de círculo hacia dentro y hacia fuera; EMPALME; CHAFLAN; SIMETRIA; GIRA; ESCALA; DESPLAZA; DESCOMP; UNIR; RECORTA; ALARGA |
| `d2d-esquinas.mjs` | Que EMPALME y CHAFLAN conserven el lado designado, se designe cerca de la esquina, lejos o justo en la mitad |
| `d2d-arcos.mjs` | Empalme entre arco y línea, y que dos objetos tangentes se rechacen en vez de dejar un arco de barrido cero |

Las dos últimas nacieron de sendos fallos reales: el empalme se quedaba
con el trozo equivocado cuando se designaba cerca de la esquina —que es
justo como se trabaja— y empalmar tangentes dejaba un objeto invisible
metido en el dibujo.
