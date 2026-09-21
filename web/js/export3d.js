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
        if (handleFn) p(5, handleFn());
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
      if (handleFn) p(5, handleFn());
      p(100, 'AcDbEntity'); p(8, layer);
      p(100, 'AcDb3dPolyline');
      p(66, 1); p(10, 0); p(20, 0); p(30, 0);
      p(70, 64);                                   /* 64 = polyface mesh */
      p(71, mesh.verts.length); p(72, tris.length);
      for (var i = 0; i < mesh.verts.length; i++) {
        var v = mesh.verts[i];
        p(0, 'VERTEX');
        if (handleFn) p(5, handleFn());
        p(100, 'AcDbEntity'); p(8, layer);
        p(100, 'AcDbVertex'); p(100, 'AcDbPolyFaceMeshVertex');
        p(10, v.x); p(20, v.y); p(30, v.z);
        p(70, 192);                                /* 64|128 vértice de malla */
      }
      for (i = 0; i < tris.length; i++) {
        p(0, 'VERTEX');
        if (handleFn) p(5, handleFn());
        p(100, 'AcDbEntity'); p(8, layer);
        p(100, 'AcDbVertex'); p(100, 'AcDbFaceRecord');
        p(10, 0); p(20, 0); p(30, 0);
        p(70, 128);
        p(71, tris[i][0] + 1); p(72, tris[i][1] + 1); p(73, tris[i][2] + 1);
      }
      p(0, 'SEQEND');
      if (handleFn) p(5, handleFn());
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
  function soldaduraPara(mesh) {
    if (!mesh || !mesh.verts.length) return 1e-7;
    var b = mesh.bbox();
    var diag = Math.hypot(b.x2 - b.x1, b.y2 - b.y1, b.z2 - b.z1);
    return Math.max(1e-7, diag * 5e-7);
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
    return mesh.weld(soldaduraPara(mesh)).clean();
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
    return mesh.verts.length ? mesh.weld(soldaduraPara(mesh)).clean() : null;
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
    return mesh.verts.length ? mesh.clean() : null;
  };

  /* Lector de PLY (ascii) */
  X.readPly = function (txt) {
    if (typeof txt !== 'string') txt = new TextDecoder().decode(txt);
    var end = txt.indexOf('end_header');
    if (end < 0) return null;
    var hdr = txt.slice(0, end).split('\n');
    var nv = 0, nf = 0, bin = false;
    for (var i = 0; i < hdr.length; i++) {
      var t = hdr[i].trim();
      if (/^format\s+binary/.test(t)) bin = true;
      var m2 = /^element\s+vertex\s+(\d+)/.exec(t); if (m2) nv = +m2[1];
      m2 = /^element\s+face\s+(\d+)/.exec(t); if (m2) nf = +m2[1];
    }
    if (bin) return null;
    var body = txt.slice(end + 'end_header'.length).split('\n').filter(function (s) { return s.trim(); });
    var mesh = new M.Mesh([], []);
    for (i = 0; i < nv && i < body.length; i++) {
      var p = body[i].trim().split(/\s+/);
      mesh.verts.push(G3.v(+p[0], +p[1], +p[2]));
    }
    for (var j = 0; j < nf && nv + j < body.length; j++) {
      p = body[nv + j].trim().split(/\s+/);
      var n = +p[0], f = [];
      for (var k = 1; k <= n; k++) f.push(+p[k]);
      if (f.length >= 3) mesh.faces.push(f);
    }
    return mesh.verts.length ? mesh.clean() : null;
  };
})();
