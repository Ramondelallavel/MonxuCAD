/* ============================================================
   export3d.js — Escritura de formatos 3D
   STL (texto y binario), OBJ + MTL, PLY (texto y binario),
   3MF (ZIP + XML), glTF 2.0 / GLB, OFF, AMF, VRML 2.0, X3D,
   y mallas DXF (3DFACE y POLYFACE MESH).
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G3 = CAD.G3, M = CAD.Mesh, S = CAD.Solid;
  var X = (CAD.Export3D = {});

  function n6(v) {
    if (!isFinite(v)) return '0';
    var s = v.toFixed(6);
    return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  X.n6 = n6;

  /* Reúne las mallas seleccionadas en una sola, con sus colores */
  X.collect = function (ents, doc, app, raw) {
    var parts = [];
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (!S.is3D(e)) continue;
      var m = S.meshOf(e);
      if (!m || !m.faces.length) continue;
      /* para exportar se usa la malla triangulada y reparada: los
         formatos de fabricación exigen una superficie cerrada */
      if (!raw) { try { m = m.triangulated(1e-5); } catch (err) { } }
      var hex = app && app.r && app.r.colorOf ? app.r.colorOf(e, doc) : '#cccccc';
      parts.push({ mesh: m, ent: e, color: hex, name: (e.name || (e.type + '_' + e.id)) });
    }
    return parts;
  };

  X.merge = function (parts) {
    var out = new M.Mesh([], []);
    for (var i = 0; i < parts.length; i++) out.append(parts[i].mesh);
    return out;
  };

  /* ============================================================
     STL
     ============================================================ */
  X.stlAscii = function (parts, name) {
    var L = ['solid ' + (name || 'MonxuCAD')];
    for (var q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh, tris = mesh.triangles();
      for (var i = 0; i < tris.length; i++) {
        var a = mesh.verts[tris[i][0]], b = mesh.verts[tris[i][1]], c = mesh.verts[tris[i][2]];
        var n = G3.norm(G3.cross(G3.sub(b, a), G3.sub(c, a)));
        L.push('  facet normal ' + n6(n.x) + ' ' + n6(n.y) + ' ' + n6(n.z));
        L.push('    outer loop');
        L.push('      vertex ' + n6(a.x) + ' ' + n6(a.y) + ' ' + n6(a.z));
        L.push('      vertex ' + n6(b.x) + ' ' + n6(b.y) + ' ' + n6(b.z));
        L.push('      vertex ' + n6(c.x) + ' ' + n6(c.y) + ' ' + n6(c.z));
        L.push('    endloop');
        L.push('  endfacet');
      }
    }
    L.push('endsolid ' + (name || 'MonxuCAD'));
    return L.join('\n') + '\n';
  };

  /* STL binario con color por triángulo (extensión VisCAM/SolidView) */
  X.stlBinary = function (parts, name) {
    var total = 0, q, i;
    var tl = [];
    for (q = 0; q < parts.length; q++) {
      var t = parts[q].mesh.triangles();
      tl.push(t); total += t.length;
    }
    var buf = new ArrayBuffer(84 + total * 50);
    var dv = new DataView(buf);
    var hdr = 'MonxuCAD binary STL ' + (name || '');
    for (i = 0; i < 80; i++) dv.setUint8(i, i < hdr.length ? hdr.charCodeAt(i) & 0x7f : 0x20);
    dv.setUint32(80, total, true);
    var off = 84;
    for (q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh, tris = tl[q];
      var rgb = hex2rgb15(parts[q].color);
      for (i = 0; i < tris.length; i++) {
        var a = mesh.verts[tris[i][0]], b = mesh.verts[tris[i][1]], c = mesh.verts[tris[i][2]];
        var n = G3.norm(G3.cross(G3.sub(b, a), G3.sub(c, a)));
        dv.setFloat32(off, n.x, true); dv.setFloat32(off + 4, n.y, true); dv.setFloat32(off + 8, n.z, true);
        dv.setFloat32(off + 12, a.x, true); dv.setFloat32(off + 16, a.y, true); dv.setFloat32(off + 20, a.z, true);
        dv.setFloat32(off + 24, b.x, true); dv.setFloat32(off + 28, b.y, true); dv.setFloat32(off + 32, b.z, true);
        dv.setFloat32(off + 36, c.x, true); dv.setFloat32(off + 40, c.y, true); dv.setFloat32(off + 44, c.z, true);
        dv.setUint16(off + 48, rgb, true);
        off += 50;
      }
    }
    return buf;
  };
  function hex2rgb15(hex) {
    var c = CAD.View3D ? CAD.View3D.hex2rgb(hex) : [0.8, 0.8, 0.8];
    var r = Math.round(c[0] * 31), g = Math.round(c[1] * 31), b = Math.round(c[2] * 31);
    return 0x8000 | (b << 10) | (g << 5) | r;
  }

  /* ============================================================
     OBJ + MTL
     ============================================================ */
  X.obj = function (parts, name, withNormals) {
    var L = ['# MonxuCAD ' + new Date().toISOString(), 'mtllib ' + (name || 'modelo') + '.mtl'];
    var vN = [], base = 1, nbase = 1;
    for (var q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh, i, j;
      L.push('o ' + safe(parts[q].name));
      L.push('usemtl mat' + q);
      for (i = 0; i < mesh.verts.length; i++) {
        var p = mesh.verts[i];
        L.push('v ' + n6(p.x) + ' ' + n6(p.y) + ' ' + n6(p.z));
      }
      var nrm = null;
      if (withNormals !== false) {
        nrm = mesh.vertexNormals(32);
        for (i = 0; i < nrm.length; i++)
          L.push('vn ' + n6(nrm[i].x) + ' ' + n6(nrm[i].y) + ' ' + n6(nrm[i].z));
      }
      for (i = 0; i < mesh.faces.length; i++) {
        var f = mesh.faces[i], s = 'f';
        for (j = 0; j < f.length; j++) {
          var k = f[j] + base;
          s += ' ' + (nrm ? k + '//' + (f[j] + nbase) : k);
        }
        L.push(s);
      }
      base += mesh.verts.length;
      if (nrm) nbase += nrm.length;
    }
    return L.join('\n') + '\n';
  };

  X.mtl = function (parts) {
    var L = ['# MonxuCAD materiales'];
    for (var q = 0; q < parts.length; q++) {
      var c = CAD.View3D ? CAD.View3D.hex2rgb(parts[q].color) : [0.8, 0.8, 0.8];
      L.push('newmtl mat' + q);
      L.push('Ka ' + n6(c[0] * 0.25) + ' ' + n6(c[1] * 0.25) + ' ' + n6(c[2] * 0.25));
      L.push('Kd ' + n6(c[0]) + ' ' + n6(c[1]) + ' ' + n6(c[2]));
      L.push('Ks 0.35 0.35 0.35');
      L.push('Ns 42');
      L.push('d 1.0');
      L.push('illum 2');
      L.push('');
    }
    return L.join('\n');
  };
  function safe(s) { return String(s || 'objeto').replace(/[^\w\-.]+/g, '_'); }

  /* ============================================================
     PLY
     ============================================================ */
  X.ply = function (parts, binary) {
    var mesh = X.merge(parts);
    /* color por vértice tomado de la parte a la que pertenece */
    var colors = [], q, i;
    for (q = 0; q < parts.length; q++) {
      var c = CAD.View3D ? CAD.View3D.hex2rgb(parts[q].color) : [0.8, 0.8, 0.8];
      var rgb = [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
      for (i = 0; i < parts[q].mesh.verts.length; i++) colors.push(rgb);
    }
    var hdr = ['ply',
      'format ' + (binary ? 'binary_little_endian' : 'ascii') + ' 1.0',
      'comment creado por MonxuCAD',
      'element vertex ' + mesh.verts.length,
      'property float x', 'property float y', 'property float z',
      'property uchar red', 'property uchar green', 'property uchar blue',
      'element face ' + mesh.faces.length,
      'property list uchar int vertex_indices',
      'end_header'].join('\n') + '\n';
    if (!binary) {
      var L = [hdr.slice(0, -1)];
      for (i = 0; i < mesh.verts.length; i++) {
        var p = mesh.verts[i], cc = colors[i] || [200, 200, 200];
        L.push(n6(p.x) + ' ' + n6(p.y) + ' ' + n6(p.z) + ' ' + cc[0] + ' ' + cc[1] + ' ' + cc[2]);
      }
      for (i = 0; i < mesh.faces.length; i++) {
        var f = mesh.faces[i];
        L.push(f.length + ' ' + f.join(' '));
      }
      return L.join('\n') + '\n';
    }
    var fbytes = 0;
    for (i = 0; i < mesh.faces.length; i++) fbytes += 1 + mesh.faces[i].length * 4;
    var he = new TextEncoder().encode(hdr);
    var buf = new ArrayBuffer(he.length + mesh.verts.length * 15 + fbytes);
    var u8 = new Uint8Array(buf), dv = new DataView(buf);
    u8.set(he, 0);
    var off = he.length;
    for (i = 0; i < mesh.verts.length; i++) {
      p = mesh.verts[i]; cc = colors[i] || [200, 200, 200];
      dv.setFloat32(off, p.x, true); dv.setFloat32(off + 4, p.y, true); dv.setFloat32(off + 8, p.z, true);
      dv.setUint8(off + 12, cc[0]); dv.setUint8(off + 13, cc[1]); dv.setUint8(off + 14, cc[2]);
      off += 15;
    }
    for (i = 0; i < mesh.faces.length; i++) {
      f = mesh.faces[i];
      dv.setUint8(off++, f.length);
      for (var j = 0; j < f.length; j++) { dv.setInt32(off, f[j], true); off += 4; }
    }
    return buf;
  };

  /* ============================================================
     OFF
     ============================================================ */
  X.off = function (parts) {
    var mesh = X.merge(parts);
    var L = ['OFF', mesh.verts.length + ' ' + mesh.faces.length + ' 0'];
    for (var i = 0; i < mesh.verts.length; i++) {
      var p = mesh.verts[i];
      L.push(n6(p.x) + ' ' + n6(p.y) + ' ' + n6(p.z));
    }
    for (i = 0; i < mesh.faces.length; i++) L.push(mesh.faces[i].length + ' ' + mesh.faces[i].join(' '));
    return L.join('\n') + '\n';
  };

  /* ============================================================
     3MF  (paquete OPC: ZIP con [Content_Types].xml y 3D/3dmodel.model)
     ============================================================ */
  X.model3mf = function (parts, unit) {
    var L = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<model unit="' + (unit || 'millimeter') + '" xml:lang="en-US" ' +
      'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
      'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">',
      '  <metadata name="Application">MonxuCAD</metadata>',
      '  <metadata name="CreationDate">' + new Date().toISOString().slice(0, 10) + '</metadata>',
      '  <resources>'];
    /* grupo de colores */
    L.push('    <m:colorgroup id="1">');
    for (var q = 0; q < parts.length; q++) {
      var hex = (parts[q].color || '#cccccc').replace('#', '');
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      L.push('      <m:color color="#' + hex.toUpperCase() + 'FF"/>');
    }
    L.push('    </m:colorgroup>');
    var ids = [];
    for (q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh, id = q + 2;
      ids.push(id);
      L.push('    <object id="' + id + '" type="model" pid="1" pindex="' + q + '" name="' + esc(parts[q].name) + '">');
      L.push('      <mesh>');
      L.push('        <vertices>');
      for (var i = 0; i < mesh.verts.length; i++) {
        var p = mesh.verts[i];
        L.push('          <vertex x="' + n6(p.x) + '" y="' + n6(p.y) + '" z="' + n6(p.z) + '"/>');
      }
      L.push('        </vertices>');
      L.push('        <triangles>');
      var tris = mesh.triangles();
      for (i = 0; i < tris.length; i++)
        L.push('          <triangle v1="' + tris[i][0] + '" v2="' + tris[i][1] + '" v3="' + tris[i][2] + '"/>');
      L.push('        </triangles>');
      L.push('      </mesh>');
      L.push('    </object>');
    }
    L.push('  </resources>');
    L.push('  <build>');
    for (q = 0; q < ids.length; q++) L.push('    <item objectid="' + ids[q] + '"/>');
    L.push('  </build>');
    L.push('</model>');
    return L.join('\n');
  };
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  X.esc = esc;

  X.files3mf = function (parts, unit) {
    return [
      { name: '[Content_Types].xml', data:
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
        '</Types>' },
      { name: '_rels/.rels', data:
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Target="/3D/3dmodel.model" Id="rel0" ' +
        'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>' },
      { name: '3D/3dmodel.model', data: X.model3mf(parts, unit) }
    ];
  };

  /* ============================================================
     glTF 2.0 (.gltf con búfer incrustado) y GLB
     ============================================================ */
  X.gltf = function (parts, name, glb) {
    var chunks = [], accessors = [], bufferViews = [], meshes = [], nodes = [], materials = [];
    var offset = 0, q, i;
    var blobs = [];

    function pad4(n) { return (4 - (n % 4)) % 4; }

    for (q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh;
      var tris = mesh.triangles();
      var nrm = mesh.vertexNormals(32);
      var nv = mesh.verts.length;
      /* posiciones */
      var pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
      var bb = mesh.bbox();
      for (i = 0; i < nv; i++) {
        pos[i * 3] = mesh.verts[i].x; pos[i * 3 + 1] = mesh.verts[i].y; pos[i * 3 + 2] = mesh.verts[i].z;
        nor[i * 3] = nrm[i].x; nor[i * 3 + 1] = nrm[i].y; nor[i * 3 + 2] = nrm[i].z;
      }
      var big = nv > 65535;
      var idx = big ? new Uint32Array(tris.length * 3) : new Uint16Array(tris.length * 3);
      for (i = 0; i < tris.length; i++) {
        idx[i * 3] = tris[i][0]; idx[i * 3 + 1] = tris[i][1]; idx[i * 3 + 2] = tris[i][2];
      }
      function push(arr, target) {
        var b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
        var bv = { buffer: 0, byteOffset: offset, byteLength: b.length };
        if (target) bv.target = target;
        bufferViews.push(bv);
        blobs.push(b);
        offset += b.length;
        var pd = pad4(offset);
        if (pd) { blobs.push(new Uint8Array(pd)); offset += pd; }
        return bufferViews.length - 1;
      }
      var bvP = push(pos, 34962), bvN = push(nor, 34962), bvI = push(idx, 34963);
      accessors.push({ bufferView: bvP, componentType: 5126, count: nv, type: 'VEC3',
                       min: [bb.x1, bb.y1, bb.z1], max: [bb.x2, bb.y2, bb.z2] });
      var aP = accessors.length - 1;
      accessors.push({ bufferView: bvN, componentType: 5126, count: nv, type: 'VEC3' });
      var aN = accessors.length - 1;
      accessors.push({ bufferView: bvI, componentType: big ? 5125 : 5123, count: idx.length, type: 'SCALAR' });
      var aI = accessors.length - 1;
      var c = CAD.View3D ? CAD.View3D.hex2rgb(parts[q].color) : [0.8, 0.8, 0.8];
      materials.push({ name: 'mat' + q, pbrMetallicRoughness: {
        baseColorFactor: [c[0], c[1], c[2], 1], metallicFactor: 0.15, roughnessFactor: 0.62 },
        doubleSided: true });
      meshes.push({ name: parts[q].name, primitives: [{ attributes: { POSITION: aP, NORMAL: aN },
                     indices: aI, material: q, mode: 4 }] });
      nodes.push({ mesh: q, name: parts[q].name });
    }

    var totalLen = offset;
    var bin = new Uint8Array(totalLen);
    var o = 0;
    for (i = 0; i < blobs.length; i++) { bin.set(blobs[i], o); o += blobs[i].length; }

    var json = {
      asset: { version: '2.0', generator: 'MonxuCAD' },
      scene: 0,
      scenes: [{ nodes: nodes.map(function (_, k) { return k; }), name: name || 'Escena' }],
      nodes: nodes, meshes: meshes, materials: materials,
      accessors: accessors, bufferViews: bufferViews,
      buffers: [{ byteLength: totalLen }]
    };

    if (!glb) {
      json.buffers[0].uri = 'data:application/octet-stream;base64,' + b64(bin);
      return JSON.stringify(json, null, 1);
    }
    var js = new TextEncoder().encode(JSON.stringify(json));
    var jpad = (4 - (js.length % 4)) % 4;
    var bpad = (4 - (bin.length % 4)) % 4;
    var total = 12 + 8 + js.length + jpad + 8 + bin.length + bpad;
    var out = new ArrayBuffer(total);
    var dv = new DataView(out), u8 = new Uint8Array(out);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, js.length + jpad, true); dv.setUint32(16, 0x4E4F534A, true);
    u8.set(js, 20);
    for (i = 0; i < jpad; i++) u8[20 + js.length + i] = 0x20;
    var bo = 20 + js.length + jpad;
    dv.setUint32(bo, bin.length + bpad, true); dv.setUint32(bo + 4, 0x004E4942, true);
    u8.set(bin, bo + 8);
    return out;
  };

  function b64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH)
      s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  X.b64 = b64;

  /* ============================================================
     AMF (Additive Manufacturing Format)
     ============================================================ */
  X.amf = function (parts, unit) {
    var L = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<amf unit="' + (unit || 'millimeter') + '" version="1.1">',
      '  <metadata type="producer">MonxuCAD</metadata>'];
    for (var q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh;
      var c = CAD.View3D ? CAD.View3D.hex2rgb(parts[q].color) : [0.8, 0.8, 0.8];
      L.push('  <material id="' + (q + 1) + '"><color><r>' + n6(c[0]) + '</r><g>' + n6(c[1]) +
             '</g><b>' + n6(c[2]) + '</b></color></material>');
      L.push('  <object id="' + (q + 1) + '">');
      L.push('    <mesh><vertices>');
      for (var i = 0; i < mesh.verts.length; i++) {
        var p = mesh.verts[i];
        L.push('      <vertex><coordinates><x>' + n6(p.x) + '</x><y>' + n6(p.y) +
               '</y><z>' + n6(p.z) + '</z></coordinates></vertex>');
      }
      L.push('    </vertices>');
      L.push('    <volume materialid="' + (q + 1) + '">');
      var tris = mesh.triangles();
      for (i = 0; i < tris.length; i++)
        L.push('      <triangle><v1>' + tris[i][0] + '</v1><v2>' + tris[i][1] + '</v2><v3>' + tris[i][2] + '</v3></triangle>');
      L.push('    </volume></mesh>');
      L.push('  </object>');
    }
    L.push('</amf>');
    return L.join('\n');
  };

  /* ============================================================
     VRML 2.0 y X3D
     ============================================================ */
  X.wrl = function (parts) {
    var L = ['#VRML V2.0 utf8', '# MonxuCAD', ''];
    for (var q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh;
      var c = CAD.View3D ? CAD.View3D.hex2rgb(parts[q].color) : [0.8, 0.8, 0.8];
      L.push('Shape {');
      L.push('  appearance Appearance { material Material { diffuseColor ' +
             n6(c[0]) + ' ' + n6(c[1]) + ' ' + n6(c[2]) + ' } }');
      L.push('  geometry IndexedFaceSet {');
      L.push('    solid TRUE');
      L.push('    coord Coordinate { point [');
      var pts = [];
      for (var i = 0; i < mesh.verts.length; i++) {
        var p = mesh.verts[i];
        pts.push(n6(p.x) + ' ' + n6(p.y) + ' ' + n6(p.z));
      }
      L.push('      ' + pts.join(', '));
      L.push('    ] }');
      L.push('    coordIndex [');
      var fi = [];
      for (i = 0; i < mesh.faces.length; i++) fi.push(mesh.faces[i].join(', ') + ', -1');
      L.push('      ' + fi.join(',\n      '));
      L.push('    ]');
      L.push('  }');
      L.push('}');
    }
    return L.join('\n') + '\n';
  };

  X.x3d = function (parts) {
    var L = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 3.3//EN" "http://www.web3d.org/specifications/x3d-3.3.dtd">',
      '<X3D profile="Interchange" version="3.3">', '  <head><meta name="generator" content="MonxuCAD"/></head>', '  <Scene>'];
    for (var q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh;
      var c = CAD.View3D ? CAD.View3D.hex2rgb(parts[q].color) : [0.8, 0.8, 0.8];
      var ci = [], pt = [], i;
      for (i = 0; i < mesh.faces.length; i++) ci.push(mesh.faces[i].join(' ') + ' -1');
      for (i = 0; i < mesh.verts.length; i++) {
        var p = mesh.verts[i];
        pt.push(n6(p.x) + ' ' + n6(p.y) + ' ' + n6(p.z));
      }
      L.push('    <Shape>');
      L.push('      <Appearance><Material diffuseColor="' + n6(c[0]) + ' ' + n6(c[1]) + ' ' + n6(c[2]) + '"/></Appearance>');
      L.push('      <IndexedFaceSet solid="true" coordIndex="' + ci.join(' ') + '">');
      L.push('        <Coordinate point="' + pt.join(' ') + '"/>');
      L.push('      </IndexedFaceSet>');
      L.push('    </Shape>');
    }
    L.push('  </Scene>', '</X3D>');
    return L.join('\n');
  };

  /* ============================================================
     Entidades de malla DXF
     ============================================================ */
  /* 3DFACE: una entidad por triángulo, la forma más compatible */
  X.dxf3dface = function (parts, handleFn) {
    var out = [];
    function p(c, v) { out.push(c, v); }
    for (var q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh, tris = mesh.triangles();
      var layer = (parts[q].ent && parts[q].ent.layer) || '0';
      for (var i = 0; i < tris.length; i++) {
        var a = mesh.verts[tris[i][0]], b = mesh.verts[tris[i][1]], c = mesh.verts[tris[i][2]];
        p(0, '3DFACE');
        if (typeof handleFn === 'function') p(5, handleFn());
        p(100, 'AcDbEntity'); p(8, layer);
        p(100, 'AcDbFace');
        p(10, a.x); p(20, a.y); p(30, a.z);
        p(11, b.x); p(21, b.y); p(31, b.z);
        p(12, c.x); p(22, c.y); p(32, c.z);
        p(13, c.x); p(23, c.y); p(33, c.z);   /* 4º = 3º -> triángulo */
      }
    }
    return out;
  };

  /* POLYFACE MESH: una sola entidad con todos los vértices y caras */
  X.dxfPolyface = function (parts, handleFn) {
    var out = [];
    function p(c, v) { out.push(c, v); }
    for (var q = 0; q < parts.length; q++) {
      var mesh = parts[q].mesh;
      var layer = (parts[q].ent && parts[q].ent.layer) || '0';
      var tris = mesh.triangles();
      p(0, 'POLYLINE');
      if (typeof handleFn === 'function') p(5, handleFn());
      p(100, 'AcDbEntity'); p(8, layer);
      p(100, 'AcDb3dPolyline');
      p(66, 1); p(10, 0); p(20, 0); p(30, 0);
      p(70, 64);                                   /* 64 = polyface mesh */
      p(71, mesh.verts.length); p(72, tris.length);
      for (var i = 0; i < mesh.verts.length; i++) {
        var v = mesh.verts[i];
        p(0, 'VERTEX');
        if (typeof handleFn === 'function') p(5, handleFn());
        p(100, 'AcDbEntity'); p(8, layer);
        p(100, 'AcDbVertex'); p(100, 'AcDbPolyFaceMeshVertex');
        p(10, v.x); p(20, v.y); p(30, v.z);
        p(70, 192);                                /* 64|128 vértice de malla */
      }
      for (i = 0; i < tris.length; i++) {
        p(0, 'VERTEX');
        if (typeof handleFn === 'function') p(5, handleFn());
        p(100, 'AcDbEntity'); p(8, layer);
        p(100, 'AcDbVertex'); p(100, 'AcDbFaceRecord');
        p(10, 0); p(20, 0); p(30, 0);
        p(70, 128);
        p(71, tris[i][0] + 1); p(72, tris[i][1] + 1); p(73, tris[i][2] + 1);
      }
      p(0, 'SEQEND');
      if (typeof handleFn === 'function') p(5, handleFn());
      p(8, layer);
    }
    return out;
  };

  /* ============================================================
     Lector de STL (texto y binario) para importar
     ============================================================ */
  /* ------------------------------------------------------------
     Tolerancia de soldadura al leer una malla de un archivo.
     El STL binario guarda las coordenadas en float32: unos siete dígitos.
     En una pieza de 100 mm, dos vértices que eran el mismo número en
     doble precisión pueden llegar separados hasta una cienmilésima, muy
     por encima de la tolerancia fija de 1e-6 con la que se soldaba.  El
     resultado era una malla llena de grietas: se leían menos triángulos
     de los escritos y la pieza dejaba de ser estanca justo cuando se iba
     a fabricar.  La tolerancia se saca ahora del tamaño de la propia
     pieza, muy por debajo de cualquier detalle real.
     ------------------------------------------------------------ */
  /* Tolerancia con la que se sueldan los vértices de un STL recién
     leído.

     Lo que limita no es el tamaño de la pieza sino la coma flotante de
     32 bits con la que se guarda el formato: su paso lo marca la
     coordenada más grande, no la diagonal.  Con un par de pasos basta
     para cerrar las grietas que deja el redondeo del fichero.  Antes se
     usaba media millonésima de la diagonal, que en una placa de ciento
     veinte milímetros son setenta y dos micras: eso se llevaba por
     delante los detalles de una pieza mecánica de verdad y dejaba la
     malla no-manifold justo al importarla. */
  function soldaduraPara(mesh) {
    if (!mesh || !mesh.verts.length) return 1e-7;
    var b = mesh.bbox();
    var may = Math.max(Math.abs(b.x1), Math.abs(b.x2), Math.abs(b.y1),
                       Math.abs(b.y2), Math.abs(b.z1), Math.abs(b.z2));
    if (!isFinite(may) || may <= 0) may = 1;
    return Math.max(1e-7, may * 2.4e-7);
  }
  X.soldaduraPara = soldaduraPara;

  X.readStl = function (data) {
    if (typeof data === 'string') return readStlAscii(data);
    var u8 = new Uint8Array(data);
    /* heurística: cabecera "solid" + tamaño coherente con el binario */
    var head = '';
    for (var i = 0; i < Math.min(5, u8.length); i++) head += String.fromCharCode(u8[i]);
    if (head === 'solid' && u8.length > 84) {
      var dv0 = new DataView(data);
      var n0 = dv0.getUint32(80, true);
      if (84 + n0 * 50 !== u8.length) return readStlAscii(new TextDecoder().decode(u8));
    }
    if (u8.length < 84) return null;
    var dv = new DataView(data);
    var n = dv.getUint32(80, true);
    if (84 + n * 50 > u8.length) return readStlAscii(new TextDecoder().decode(u8));
    var mesh = new M.Mesh([], []);
    var off = 84;
    for (i = 0; i < n; i++) {
      var base = mesh.verts.length;
      for (var k = 0; k < 3; k++) {
        mesh.verts.push(G3.v(dv.getFloat32(off + 12 + k * 12, true),
                             dv.getFloat32(off + 16 + k * 12, true),
                             dv.getFloat32(off + 20 + k * 12, true)));
      }
      mesh.faces.push([base, base + 1, base + 2]);
      off += 50;
    }
    /* Los triángulos muy finos NO se tiran: un STL binario guarda las
       coordenadas en coma flotante de 32 bits, y al redondear ahí alguno
       se queda sin área.  Quitarlo abre la malla —en una placa empalmada
       eran dos triángulos y seis aristas sueltas—, mientras que dejarlo
       no molesta a nadie: sigue formando parte de la superficie. */
    return mesh.weld(soldaduraPara(mesh)).clean(true);
  };
  function readStlAscii(txt) {
    var mesh = new M.Mesh([], []);
    var re = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g, m2, buf = [];
    while ((m2 = re.exec(txt))) {
      buf.push(G3.v(parseFloat(m2[1]), parseFloat(m2[2]), parseFloat(m2[3])));
      if (buf.length === 3) {
        var b = mesh.verts.length;
        mesh.verts.push(buf[0], buf[1], buf[2]);
        mesh.faces.push([b, b + 1, b + 2]);
        buf = [];
      }
    }
    return mesh.verts.length ? mesh.weld(soldaduraPara(mesh)).clean(true) : null;
  }

  /* Lector de OBJ */
  X.readObj = function (txt) {
    var mesh = new M.Mesh([], []);
    var lines = txt.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t[0] === '#') continue;
      var p = t.split(/\s+/);
      if (p[0] === 'v') {
        var vx = +p[1], vy = +p[2], vz = +p[3];
        if (!isFinite(vx) || !isFinite(vy) || !isFinite(vz)) continue;
        mesh.verts.push(G3.v(vx, vy, vz));
      } else if (p[0] === 'f') {
        var f = [], roto = false;
        for (var j = 1; j < p.length; j++) {
          var k = parseInt(p[j].split('/')[0], 10);
          if (!k) continue;
          var idx = k > 0 ? k - 1 : mesh.verts.length + k;
          /* un índice fuera de la lista tumbaba la lectura entera */
          if (idx < 0 || idx >= mesh.verts.length) { roto = true; break; }
          f.push(idx);
        }
        if (!roto && f.length >= 3) mesh.faces.push(f);
      }
    }
    return mesh.verts.length ? mesh.clean(true) : null;
  };

  /* Lector de PLY (ascii) */
  /* ------------------------------------------------------------
     PLY: cabecera de texto y cuerpo en texto o binario.  Se admite
     cualquier orden y número de propiedades: se buscan x, y, z entre las
     del vértice y la lista de índices entre las de la cara, que es lo
     único que hace falta para la geometría.
     ------------------------------------------------------------ */
  var TIPOS = { char: 1, int8: 1, uchar: 1, uint8: 1, short: 2, int16: 2, ushort: 2, uint16: 2,
                int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
  function leeTipo(dv, off, tipo, le) {
    switch (tipo) {
      case 'char': case 'int8': return dv.getInt8(off);
      case 'uchar': case 'uint8': return dv.getUint8(off);
      case 'short': case 'int16': return dv.getInt16(off, le);
      case 'ushort': case 'uint16': return dv.getUint16(off, le);
      case 'int': case 'int32': return dv.getInt32(off, le);
      case 'uint': case 'uint32': return dv.getUint32(off, le);
      case 'float': case 'float32': return dv.getFloat32(off, le);
      case 'double': case 'float64': return dv.getFloat64(off, le);
    }
    return 0;
  }
  X.readPly = function (datos) {
    var u8 = null, txt = null;
    if (typeof datos === 'string') txt = datos;
    else { u8 = datos instanceof Uint8Array ? datos : new Uint8Array(datos); }
    /* la cabecera siempre es texto, aunque el cuerpo no lo sea */
    var cab;
    if (txt !== null) cab = txt;
    else {
      var lim = Math.min(u8.length, 65536), s = '';
      for (var z = 0; z < lim; z++) s += String.fromCharCode(u8[z]);
      cab = s;
    }
    var fin = cab.indexOf('end_header');
    if (fin < 0) return null;
    var finLinea = cab.indexOf('\n', fin);
    if (finLinea < 0) return null;
    var lineas = cab.slice(0, fin).split('\n');
    var formato = 'ascii', elems = [], actual = null;
    for (var i = 0; i < lineas.length; i++) {
      var t = lineas[i].trim();
      var m = /^format\s+(\S+)/.exec(t);
      if (m) { formato = m[1]; continue; }
      m = /^element\s+(\S+)\s+(\d+)/.exec(t);
      if (m) { actual = { nombre: m[1], n: +m[2], props: [] }; elems.push(actual); continue; }
      m = /^property\s+list\s+(\S+)\s+(\S+)\s+(\S+)/.exec(t);
      if (m && actual) { actual.props.push({ lista: true, cuenta: m[1], tipo: m[2], nombre: m[3] }); continue; }
      m = /^property\s+(\S+)\s+(\S+)/.exec(t);
      if (m && actual) actual.props.push({ lista: false, tipo: m[1], nombre: m[2] });
    }
    var mesh = new M.Mesh([], []);
    var eV = null, eF = null;
    for (i = 0; i < elems.length; i++) {
      if (elems[i].nombre === 'vertex') eV = elems[i];
      else if (elems[i].nombre === 'face') eF = elems[i];
    }
    if (!eV) return null;

    if (/ascii/i.test(formato)) {
      var cuerpo = (txt !== null ? txt : new TextDecoder().decode(u8))
        .slice(finLinea + 1).split('\n');
      var fila = 0;
      function siguiente() {
        while (fila < cuerpo.length && !cuerpo[fila].trim()) fila++;
        return fila < cuerpo.length ? cuerpo[fila++].trim().split(/\s+/) : null;
      }
      for (var e = 0; e < elems.length; e++) {
        var el = elems[e];
        for (var k = 0; k < el.n; k++) {
          var campos = siguiente(); if (!campos) break;
          if (el === eV) {
            var vals = {}, c = 0;
            for (var pj = 0; pj < el.props.length; pj++) {
              var pr = el.props[pj];
              if (pr.lista) { var nn = +campos[c++]; c += nn; continue; }
              vals[pr.nombre] = +campos[c++];
            }
            mesh.verts.push(G3.v(vals.x || 0, vals.y || 0, vals.z || 0));
          } else if (el === eF) {
            var c2 = 0, cara = null;
            for (pj = 0; pj < el.props.length; pj++) {
              pr = el.props[pj];
              if (!pr.lista) { c2++; continue; }
              var cuantos = +campos[c2++], lst = [];
              for (var q2 = 0; q2 < cuantos; q2++) lst.push(+campos[c2++]);
              if (!cara && lst.length >= 3) cara = lst;
            }
            if (cara && cara.length >= 3) mesh.faces.push(cara);
          }
        }
      }
    } else {
      if (u8 === null) return null;           /* binario pedido como texto */
      var le = !/big/i.test(formato);
      var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      var off = finLinea + 1;
      for (e = 0; e < elems.length; e++) {
        el = elems[e];
        for (k = 0; k < el.n && off < u8.length; k++) {
          var vv = {}, caraB = null;
          for (pj = 0; pj < el.props.length; pj++) {
            pr = el.props[pj];
            if (pr.lista) {
              var nB = leeTipo(dv, off, pr.cuenta, le); off += TIPOS[pr.cuenta] || 1;
              var lB = [];
              for (q2 = 0; q2 < nB; q2++) { lB.push(leeTipo(dv, off, pr.tipo, le)); off += TIPOS[pr.tipo] || 4; }
              if (!caraB && lB.length >= 3) caraB = lB;
            } else {
              vv[pr.nombre] = leeTipo(dv, off, pr.tipo, le); off += TIPOS[pr.tipo] || 4;
            }
          }
          if (el === eV) mesh.verts.push(G3.v(vv.x || 0, vv.y || 0, vv.z || 0));
          else if (el === eF && caraB && caraB.length >= 3) mesh.faces.push(caraB);
        }
      }
    }
    return sano(mesh);
  };

  /* ------------------------------------------------------------
     OFF (y sus variantes COFF, NOFF, STOFF: llevan color o normal por
     vértice detrás de las coordenadas, que se ignoran)
     ------------------------------------------------------------ */
  X.readOff = function (txt) {
    if (typeof txt !== 'string') txt = new TextDecoder().decode(txt);
    var L = txt.split('\n').map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s[0] !== '#'; });
    if (!L.length || !/OFF\s*$|OFF\s+\d/.test(L[0])) return null;
    var cab, ini;
    if (/^\w*OFF$/.test(L[0])) { cab = L[1].split(/\s+/); ini = 2; }
    else { cab = L[0].replace(/^\w*OFF/, '').trim().split(/\s+/); ini = 1; }
    var nv = +cab[0], nf = +cab[1];
    if (!(nv > 0)) return null;
    var mesh = new M.Mesh([], []), i;
    for (i = 0; i < nv && ini + i < L.length; i++) {
      var p = L[ini + i].split(/\s+/);
      mesh.verts.push(G3.v(+p[0], +p[1], +p[2]));
    }
    for (i = 0; i < nf && ini + nv + i < L.length; i++) {
      var q = L[ini + nv + i].split(/\s+/);
      var n = +q[0], f = [];
      for (var k = 1; k <= n; k++) f.push(+q[k]);
      if (f.length >= 3) mesh.faces.push(f);
    }
    return sano(mesh);
  };

  /* ------------------------------------------------------------
     AMF: XML con los vértices en <coordinates> y las caras en <triangle>.
     Puede traer varios objetos; se juntan todos en una malla.
     ------------------------------------------------------------ */
  X.readAmf = function (txt) {
    if (typeof txt !== 'string') txt = new TextDecoder().decode(txt);
    var doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (!doc || doc.getElementsByTagName('parsererror').length) return null;
    var objs = doc.getElementsByTagName('object');
    if (!objs.length) return null;
    var esc = escalaUnidad((doc.documentElement.getAttribute('unit') || '').toLowerCase());
    var mesh = new M.Mesh([], []);
    for (var o = 0; o < objs.length; o++) {
      var base = mesh.verts.length;
      var vs = objs[o].getElementsByTagName('vertex');
      for (var i = 0; i < vs.length; i++) {
        var c = vs[i].getElementsByTagName('coordinates')[0];
        if (!c) continue;
        mesh.verts.push(G3.v(num(c, 'x') * esc, num(c, 'y') * esc, num(c, 'z') * esc));
      }
      var ts = objs[o].getElementsByTagName('triangle');
      for (i = 0; i < ts.length; i++) {
        var a = num(ts[i], 'v1'), b = num(ts[i], 'v2'), d = num(ts[i], 'v3');
        mesh.faces.push([base + a, base + b, base + d]);
      }
    }
    return sano(mesh);
  };
  function num(el, tag) {
    var n = el.getElementsByTagName(tag)[0];
    return n ? +(n.textContent || 0) : 0;
  }
  function escalaUnidad(u) {
    if (u === 'meter' || u === 'metre') return 1000;
    if (u === 'centimeter' || u === 'centimetre') return 10;
    if (u === 'inch') return 25.4;
    if (u === 'foot') return 304.8;
    if (u === 'micron' || u === 'micrometer') return 0.001;
    return 1;                                /* milímetro */
  }

  /* ------------------------------------------------------------
     3MF: el XML que va dentro del paquete.  Cada <item> del <build>
     coloca un objeto con su matriz; los objetos compuestos
     (<components>) se resuelven en cascada.
     ------------------------------------------------------------ */
  X.read3mfModel = function (txt) {
    if (typeof txt !== 'string') txt = new TextDecoder().decode(txt);
    var doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (!doc || doc.getElementsByTagName('parsererror').length) return null;
    var raiz = doc.documentElement;
    var esc = escalaUnidad((raiz.getAttribute('unit') || '').toLowerCase());
    var objs = {}, lista = doc.getElementsByTagName('object');
    for (var i = 0; i < lista.length; i++) objs[lista[i].getAttribute('id')] = lista[i];
    var fuera = new M.Mesh([], []);
    function mat(s) {
      if (!s) return null;
      var v = s.trim().split(/\s+/).map(Number);
      if (v.length < 12 || v.some(function (x) { return !isFinite(x); })) return null;
      /* 3MF da 4 filas de 3: la cuarta columna es siempre 0,0,0,1 */
      return [v[0], v[1], v[2], 0, v[3], v[4], v[5], 0, v[6], v[7], v[8], 0, v[9], v[10], v[11], 1];
    }
    function mete(obj, m, prof) {
      if (!obj || prof > 12) return;
      var ma = obj.getElementsByTagName('mesh')[0];
      if (ma && ma.parentNode === obj) {
        var trozo = new M.Mesh([], []);
        var vs = ma.getElementsByTagName('vertex');
        for (var j = 0; j < vs.length; j++)
          trozo.verts.push(G3.v(+vs[j].getAttribute('x') * esc, +vs[j].getAttribute('y') * esc,
                                +vs[j].getAttribute('z') * esc));
        var ts = ma.getElementsByTagName('triangle');
        for (j = 0; j < ts.length; j++)
          trozo.faces.push([+ts[j].getAttribute('v1'), +ts[j].getAttribute('v2'), +ts[j].getAttribute('v3')]);
        if (m) trozo.transform(m);
        fuera.append(trozo);
      }
      var comps = obj.getElementsByTagName('component');
      for (j = 0; j < comps.length; j++) {
        var hijo = objs[comps[j].getAttribute('objectid')];
        var mh = mat(comps[j].getAttribute('transform'));
        mete(hijo, m && mh ? G3.mMul(m, mh) : (mh || m), prof + 1);
      }
    }
    var items = doc.getElementsByTagName('item');
    if (items.length) {
      for (i = 0; i < items.length; i++)
        mete(objs[items[i].getAttribute('objectid')], mat(items[i].getAttribute('transform')), 0);
    } else {
      for (var id in objs) mete(objs[id], null, 0);
    }
    return sano(fuera);
  };
  /* Paquete .3mf completo (ZIP).  Devuelve una promesa. */
  X.read3mf = async function (buf) {
    var files = await CAD.Exporter.unzip(buf);
    var modelo = null;
    for (var i = 0; i < files.length; i++)
      if (/\.model$/i.test(files[i].name)) { modelo = files[i]; if (/3dmodel\.model$/i.test(files[i].name)) break; }
    if (!modelo) throw new Error('el paquete no lleva ningún modelo 3D');
    return X.read3mfModel(new TextDecoder().decode(modelo.data));
  };

  /* ------------------------------------------------------------
     X3D: <IndexedFaceSet coordIndex="..."> con <Coordinate point="...">
     ------------------------------------------------------------ */
  X.readX3d = function (txt) {
    if (typeof txt !== 'string') txt = new TextDecoder().decode(txt);
    var doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (!doc || doc.getElementsByTagName('parsererror').length) return null;
    var sets = doc.getElementsByTagName('IndexedFaceSet');
    if (!sets.length) return null;
    var mesh = new M.Mesh([], []);
    for (var s = 0; s < sets.length; s++) {
      var co = sets[s].getElementsByTagName('Coordinate')[0];
      if (!co) continue;
      var pts = (co.getAttribute('point') || '').trim().split(/[\s,]+/).map(Number);
      var base = mesh.verts.length;
      for (var i = 0; i + 2 < pts.length; i += 3) mesh.verts.push(G3.v(pts[i], pts[i + 1], pts[i + 2]));
      var idx = (sets[s].getAttribute('coordIndex') || '').trim().split(/[\s,]+/).map(Number);
      var cara = [];
      for (i = 0; i < idx.length; i++) {
        if (idx[i] < 0) { if (cara.length >= 3) mesh.faces.push(cara.map(function (k) { return base + k; })); cara = []; }
        else cara.push(idx[i]);
      }
      if (cara.length >= 3) mesh.faces.push(cara.map(function (k) { return base + k; }));
    }
    return sano(mesh);
  };

  /* ------------------------------------------------------------
     glTF 2.0 y GLB.  Se leen las mallas con su posición y sus índices;
     los nodos aportan la colocación de cada una.
     ------------------------------------------------------------ */
  var COMP = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'],
               5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
  var NUMCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  X.readGltf = function (datos) {
    var json = null, bin = null;
    if (typeof datos === 'string') json = JSON.parse(datos);
    else {
      var u8 = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
      var dv0 = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      if (u8.length > 12 && dv0.getUint32(0, true) === 0x46546C67) {   /* 'glTF' */
        var off = 12;
        while (off + 8 <= u8.length) {
          var len = dv0.getUint32(off, true), tipo = dv0.getUint32(off + 4, true);
          var cuerpo = u8.subarray(off + 8, off + 8 + len);
          if (tipo === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(cuerpo));
          else if (tipo === 0x004E4942) bin = cuerpo;
          off += 8 + len;
          if (len % 4) off += 4 - (len % 4);   /* los trozos van alineados a 4 */
        }
      } else json = JSON.parse(new TextDecoder().decode(u8));
    }
    if (!json || !json.meshes) return null;
    var bufs = (json.buffers || []).map(function (b) {
      if (!b.uri) return bin;
      var m = /^data:[^;]*;base64,(.*)$/.exec(b.uri);
      if (!m) return null;
      var s = atob(m[1]), a = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
      return a;
    });
    function lee(ai) {
      var ac = json.accessors[ai];
      if (!ac || ac.bufferView === undefined) return null;
      var bv = json.bufferViews[ac.bufferView];
      var buf = bufs[bv.buffer];
      if (!buf) return null;
      var comp = COMP[ac.componentType]; if (!comp) return null;
      var nc = NUMCOMP[ac.type] || 1;
      var paso = bv.byteStride || comp[0] * nc;
      var base = (bv.byteOffset || 0) + (ac.byteOffset || 0);
      var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      var out = [];
      for (var i = 0; i < ac.count; i++) {
        var fila = [];
        for (var j = 0; j < nc; j++) fila.push(dv[comp[1]](base + i * paso + j * comp[0], true));
        out.push(nc === 1 ? fila[0] : fila);
      }
      return out;
    }
    var mallas = json.meshes.map(function (me) {
      var m = new M.Mesh([], []);
      (me.primitives || []).forEach(function (pr) {
        if (pr.mode !== undefined && pr.mode !== 4) return;    /* sólo triángulos */
        if (!pr.attributes || pr.attributes.POSITION === undefined) return;
        var pos = lee(pr.attributes.POSITION); if (!pos) return;
        var base = m.verts.length;
        pos.forEach(function (p) { m.verts.push(G3.v(p[0], p[1], p[2])); });
        var idx = pr.indices !== undefined ? lee(pr.indices) : null;
        if (idx) { for (var i = 0; i + 2 < idx.length; i += 3) m.faces.push([base + idx[i], base + idx[i + 1], base + idx[i + 2]]); }
        else { for (i = 0; i + 2 < pos.length; i += 3) m.faces.push([base + i, base + i + 1, base + i + 2]); }
      });
      return m;
    });
    var fuera = new M.Mesh([], []);
    var nodos = json.nodes || [];
    function nodoM(nd) {
      if (nd.matrix) return nd.matrix.slice();
      var m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      if (nd.scale) m = G3.mMul(G3.mScale(nd.scale[0], nd.scale[1], nd.scale[2]), m);
      if (nd.rotation) m = G3.mMul(quatM(nd.rotation), m);
      if (nd.translation) m = G3.mMul(G3.mTrans(nd.translation[0], nd.translation[1], nd.translation[2]), m);
      return m;
    }
    function quatM(q) {
      var x = q[0], y = q[1], z = q[2], w = q[3];
      return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
              2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
              2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
              0, 0, 0, 1];
    }
    var visto = {};
    function anda(ni, m, prof) {
      if (prof > 20 || visto[ni + ':' + prof]) return;
      var nd = nodos[ni]; if (!nd) return;
      var mm = G3.mMul(m, nodoM(nd));
      if (nd.mesh !== undefined && mallas[nd.mesh]) {
        var c = mallas[nd.mesh].clone(); c.transform(mm); fuera.append(c);
      }
      (nd.children || []).forEach(function (h) { anda(h, mm, prof + 1); });
    }
    var raiz = (json.scenes && json.scenes[json.scene || 0] && json.scenes[json.scene || 0].nodes) || null;
    if (raiz) raiz.forEach(function (ni) { anda(ni, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1], 0); });
    else mallas.forEach(function (m) { fuera.append(m.clone()); });
    return sano(fuera);
  };

  /* ------------------------------------------------------------
     VRML 2.0: se buscan los pares "point [ ... ]" y "coordIndex [ ... ]"
     de cada IndexedFaceSet.  No es un analizador de VRML completo —no
     hace falta para la geometría— pero sí entiende varios Shape y los
     comentarios.
     ------------------------------------------------------------ */
  X.readWrl = function (txt) {
    if (typeof txt !== 'string') txt = new TextDecoder().decode(txt);
    txt = txt.replace(/#[^\n]*/g, ' ');
    var re = /IndexedFaceSet\s*\{/g, m, mesh = new M.Mesh([], []);
    while ((m = re.exec(txt))) {
      var bloque = txt.slice(m.index, m.index + 4000000);
      var mp = /point\s*\[([^\]]*)\]/.exec(bloque);
      var mi = /coordIndex\s*\[([^\]]*)\]/.exec(bloque);
      if (!mp || !mi) continue;
      var pts = mp[1].trim().split(/[\s,]+/).map(Number);
      var base = mesh.verts.length;
      for (var i = 0; i + 2 < pts.length; i += 3) mesh.verts.push(G3.v(pts[i], pts[i + 1], pts[i + 2]));
      var idx = mi[1].trim().split(/[\s,]+/).map(Number), cara = [];
      for (i = 0; i < idx.length; i++) {
        if (!isFinite(idx[i])) continue;
        if (idx[i] < 0) { if (cara.length >= 3) mesh.faces.push(cara); cara = []; }
        else cara.push(base + idx[i]);
      }
      if (cara.length >= 3) mesh.faces.push(cara);
    }
    return sano(mesh);
  };

  /* Cierre común: soldar, limpiar y devolver sólo si queda algo */
  function sano(mesh) {
    if (!mesh || !mesh.verts.length || !mesh.faces.length) return null;
    var n = mesh.verts.length, buenas = [];
    for (var i = 0; i < mesh.faces.length; i++) {
      var f = mesh.faces[i], ok = f.length >= 3;
      for (var j = 0; ok && j < f.length; j++)
        if (!(f[j] >= 0 && f[j] < n) || !isFinite(f[j])) ok = false;
      if (ok) buenas.push(f);
    }
    mesh.faces = buenas;
    for (i = 0; i < mesh.verts.length; i++) {
      var p = mesh.verts[i];
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) { p.x = p.y = p.z = 0; }
    }
    if (!mesh.faces.length) return null;
    mesh.weld(soldaduraPara(mesh));
    return mesh.clean(true);
  }
})();
