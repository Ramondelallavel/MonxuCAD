# ============================================================
#  MonxuCAD — puente DWG
#  Imagen con LibreDWG compilado. Para ODA File Converter,
#  descargue el .deb y descomente el bloque correspondiente.
# ============================================================
FROM debian:bookworm-slim AS libredwg

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git autoconf automake libtool pkg-config \
      texinfo swig python3-dev ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/LibreDWG/libredwg.git /src \
 && cd /src \
 && sh autogen.sh \
 && ./configure --disable-bindings --enable-write --prefix=/usr/local \
 && make -j"$(nproc)" \
 && make install


FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      libpcre2-8-0 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=libredwg /usr/local/bin/dwgread  /usr/local/bin/dwgread
COPY --from=libredwg /usr/local/bin/dwgwrite /usr/local/bin/dwgwrite
COPY --from=libredwg /usr/local/lib/libredwg.so* /usr/local/lib/
RUN ldconfig

# ---- ODA File Converter (opcional, mejor fidelidad) -------------
# Descargue el .deb desde https://www.opendesign.com/guestfiles/oda_file_converter
# y colóquelo junto al Dockerfile como oda.deb; después descomente:
# COPY oda.deb /tmp/oda.deb
# RUN apt-get update && apt-get install -y --no-install-recommends \
#       /tmp/oda.deb libxcb-xinerama0 libgl1 libfontconfig1 xvfb \
#  && rm -rf /var/lib/apt/lists/* /tmp/oda.deb
# ENV QT_QPA_PLATFORM=offscreen
# ----------------------------------------------------------------

WORKDIR /app
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev
COPY server ./server
COPY web ./web

ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/index.js"]
