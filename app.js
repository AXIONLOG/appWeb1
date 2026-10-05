// ===== Utilidades =====
const $ = (s, e = document) => e.querySelector(s),
  $$ = (s, e = document) => [...e.querySelectorAll(s)];
const fmt = (n, d = 0) =>
    Number(n).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d }),
  pc = (x, d = 1) => fmt(x * 100, d) + ' %',
  sol = n => 'S/ ' + fmt(n);
const norm = s =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mlab = m => {
  const x = /^(\d{4})-(\d{2})/.exec(m);
  return x ? MES[+x[2] - 1] + '-' + x[1].slice(2) : m;
};
const num = v => {
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const tag = (c, t) => `<span class="tag ${c}">${t}</span>`,
  zt = z => tag('t-' + z, z);
const kpi = (l, v, s, c = '') =>
  `<div class="card k ${c}"><span>${l}</span><b>${v}</b><span>${s || ''}</span></div>`;
const tbl = (h, r) =>
  `<div class="tw"><table><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${r.map(a => `<tr>${a.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
function csvOut(name, rows) {
  const t =
    '\ufeff' +
    rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' }));
  a.download = name + '.csv';
  a.click();
}
function parseCSV(t) {
  t = t.replace(/^\ufeff/, '');
  const d =
    (t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length
      ? ';'
      : ',';
  const r = [];
  let row = [],
    f = '',
    q = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c == '"') {
        if (t[i + 1] == '"') {
          f += '"';
          i++;
        } else q = 0;
      } else f += c;
    } else if (c == '"') q = 1;
    else if (c == d) {
      row.push(f);
      f = '';
    } else if (c == '\n' || c == '\r') {
      if (c == '\r' && t[i + 1] == '\n') i++;
      row.push(f);
      r.push(row);
      row = [];
      f = '';
    } else f += c;
  }
  if (f || row.length) {
    row.push(f);
    r.push(row);
  }
  return r.filter(x => x.some(y => y.trim()));
}
const toObjs = t => {
  const r = parseCSV(t),
    h = r[0].map(norm);
  return r.slice(1).map(x => Object.fromEntries(h.map((k, i) => [k, (x[i] || '').trim()])));
};

// ===== Ajustes =====
const AJD = [
  [
    'Servicio',
    [
      ['meta', 'Meta contractual OTIF (%)'],
      ['z', 'Nivel de servicio stock de seguridad (%)', 'sel']
    ]
  ],
  [
    'Picking',
    [
      ['vel', 'Velocidad de desplazamiento (m/s)'],
      ['tpl', 'Tiempo por línea de picking (s)'],
      ['frioMax', 'Límite de exposición al frío (min)'],
      ['costoH', 'Costo hora de operario (S/)'],
      ['minMej', 'Mejora mínima para proponer un traslado (m)']
    ]
  ],
  [
    'Inventario',
    [
      ['ciclo', 'Ciclo de reposición (días de demanda a cubrir)'],
      ['ltS', 'Lead time zona Seco (días)'],
      ['ltF', 'Lead time zona Frío (días)'],
      ['ltC', 'Lead time zona Congelado (días)'],
      ['vent', 'Ventana para calcular la demanda (días)'],
      ['cv', 'Variabilidad de demanda (CV)'],
      ['eri', 'Meta de exactitud ERI (%)']
    ]
  ],
  [
    'Reducción de incidencias por módulo (supuesto, %)',
    [
      ['rUb', 'Ubicaciones erróneas con el módulo 1'],
      ['rEri', 'Diferencias en conteos con el módulo 3'],
      ['rRop', 'Falta de productos con el módulo 3']
    ]
  ]
];
const AJ0 = {
  meta: 97,
  z: 95,
  vel: 1.2,
  tpl: 15,
  frioMax: 12,
  costoH: 10,
  minMej: 10,
  ciclo: 14,
  ltS: 4,
  ltF: 2,
  ltC: 3,
  vent: 90,
  cv: 0.3,
  eri: 98,
  rUb: 50,
  rEri: 50,
  rRop: 50
};
const ZV = { 90: 1.28, 95: 1.645, 97: 1.88, 99: 2.33 };

// ===== Layout (grafo) =====
function defLayout() {
  const n = [
      { id: 'DOCK', x: 5, y: 30, tipo: 'muelle', zona: 'DOCK' },
      { id: 'W-SUR', x: 5, y: 7, tipo: 'cruce', zona: 'SECO' }
    ],
    e = [['DOCK', 'W-SUR']],
    A = { SECO: [12, 20], FRIO: [37, 45], CONGELADO: [59, 65, 71] };
  let pn = 'DOCK',
    ps = 'W-SUR';
  for (const z in A)
    A[z].forEach((x, i) => {
      const k = z[0] + '-P' + (i + 1),
        N = 'X-' + k + '-N',
        S = 'X-' + k + '-S',
        a = k + '-M01',
        b = k + '-M02';
      n.push(
        { id: N, x, y: 27, tipo: 'cruce', zona: z },
        { id: a, x, y: 22, tipo: 'rack', zona: z, pasillo: i + 1 },
        { id: S, x, y: 7, tipo: 'cruce', zona: z },
        { id: b, x, y: 12, tipo: 'rack', zona: z, pasillo: i + 1 }
      );
      e.push([a, N], [b, S], [a, b], [pn, N], [ps, S]);
      pn = N;
      ps = S;
    });
  e.splice(e.findIndex(q => q[0] == 'DOCK' && q[1] == 'X-S-P1-N') >= 0 ? 0 : 0, 0);
  return {
    nombre: 'Planta 0801 (referencial)',
    zonas: {
      SECO: { x0: 2, y0: 3, x1: 28, y1: 35, temp: '15–25 °C' },
      FRIO: { x0: 30, y0: 3, x1: 52, y1: 35, temp: '0–4 °C' },
      CONGELADO: { x0: 54, y0: 3, x1: 78, y1: 35, temp: '−18 °C' }
    },
    nodos: n,
    aristas: e
  };
}
let D = {},
  P = {},
  NID = {};
function graph() {
  NID = Object.fromEntries(LAY.nodos.map(n => [n.id, n]));
  const adj = {};
  LAY.nodos.forEach(n => (adj[n.id] = []));
  LAY.aristas.forEach(([a, b]) => {
    if (!NID[a] || !NID[b]) return;
    const w = Math.hypot(NID[a].x - NID[b].x, NID[a].y - NID[b].y);
    adj[a].push([b, w]);
    adj[b].push([a, w]);
  });
  D = {};
  P = {};
  LAY.nodos.forEach(s => {
    const d = { [s.id]: 0 },
      p = {},
      v = new Set();
    for (;;) {
      let u = null;
      for (const k in d) if (!v.has(k) && (u === null || d[k] < d[u])) u = k;
      if (u === null) break;
      v.add(u);
      adj[u].forEach(([x, w]) => {
        if (d[u] + w < (d[x] ?? 1e9)) {
          d[x] = d[u] + w;
          p[x] = u;
        }
      });
    }
    D[s.id] = d;
    P[s.id] = p;
  });
}
const path = (a, b) => {
  const r = [b];
  while (r[0] != a && P[a][r[0]]) r.unshift(P[a][r[0]]);
  return r;
};
const racks = () => LAY.nodos.filter(n => n.tipo == 'rack');

// ===== Datos de ejemplo =====
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function demo() {
  const cl = ['MCD', 'LCP', 'SBW', 'AFS'],
    um = ['CJ', 'BT', 'UN', 'CJ'],
    zs = ['SECO', 'FRIO', 'CONGELADO'],
    rk = racks(),
    inv = [];
  for (let i = 0; i < 138; i++) {
    const z = zs[i % 3 == 0 ? 0 : i % 3 == 1 ? (rnd() < 0.5 ? 0 : 1) : 2],
      rs = rk.filter(r => r.zona == z),
      c = cl[i % 4],
      cj = um[i % 4];
    const cost = +(5 + rnd() * 150).toFixed(2),
      sys = Math.round(3 + rnd() * rnd() * 300),
      ph = rnd() < 0.18 ? sys + Math.round((rnd() - 0.5) * 10) : sys;
    inv.push({
      sku: c + '-' + (1000 + i * 7),
      descripcion:
        [
          'SIROPE',
          'MASA DE PAN',
          'CAJA PARA PIZZA',
          'YOGURT',
          'QUESO',
          'BANDEJA',
          'SALCHICHA',
          'MOSTAZA'
        ][i % 8] +
        ' ' +
        (i + 1),
      cliente: c,
      um: cj,
      costounitario: cost,
      stocksistema: sys,
      stockfisico: ph,
      rack: rs[Math.floor(rnd() * rs.length)].id,
      zona: z,
      volumenm3: +(0.003 + rnd() * 0.04).toFixed(3)
    });
  }
  inv[3].rack = 'C-P1-M01';
  inv[9].rack = 'S-P1-M01';
  inv[3].zona = 'SECO';
  inv[9].zona = 'CONGELADO';
  const ped = [],
    pw = inv.map((_, i) => 1 / (i + 3)),
    tw = sum(pw);
  const pick = () => {
    let r = rnd() * tw,
      i = 0;
    while ((r -= pw[i]) > 0 && i < 137) i++;
    return inv[i].sku;
  };
  for (let o = 0; o < 400; o++) {
    const d = new Date(Date.now() - rnd() * 90 * 864e5).toISOString().slice(0, 10),
      t = inv[Math.floor(rnd() * 138)],
      n = 3 + Math.floor(rnd() * 12);
    new Set(Array.from({ length: n }, pick)).forEach(s =>
      ped.push({
        pedidoid: 'PED-' + String(o + 1).padStart(4, '0'),
        fecha: d,
        cliente: t.cliente,
        tienda: t.cliente + '-T' + String(1 + (o % 9)).padStart(3, '0'),
        sku: s,
        cantidad: String(1 + Math.floor(rnd() * 25))
      })
    );
  }
  const O = [
    [689, 758, 131455, 52],
    [803, 859, 125315, 39],
    [632, 707, 125558, 54],
    [644, 758, 138864, 73],
    [769, 825, 114393, 41],
    [748, 803, 111502, 48],
    [941, 1044, 135987, 77],
    [959, 1038, 144264, 51],
    [1087, 1140, 133663, 36],
    [842, 906, 134790, 42],
    [1026, 1082, 126190, 31],
    [1254, 1338, 164164, 49]
  ];
  const otif = O.map((o, i) => ({
    mes: '2025-' + String(i + 1).padStart(2, '0'),
    pedidosotif: o[0],
    pedidostotal: o[1],
    cajasentregadas: o[2],
    cajaspedidas: o[2],
    incidencias: o[3]
  }));
  otif.push({
    mes: '2026-09',
    pedidosotif: 29,
    pedidostotal: 32,
    cajasentregadas: 2247,
    cajaspedidas: 2247,
    incidencias: ''
  });
  const C = [
    ['Ubicaciones erróneas', 'Picking', 269],
    ['Diferencias en los conteos', 'Picking', 168],
    ['Falta de productos', 'Picking', 156],
    ['Ingresos incompletos', 'Recepción', 96],
    ['Retrasos en envíos', 'Distribución', 74],
    ['Falta de tecnología', 'Distribución', 42],
    ['Ítems trocados', 'Picking', 33],
    ['Retrasos de mercadería', 'Recepción', 17],
    ['Error en documentación', 'Recepción', 6],
    ['Daños físicos', 'Recepción', 3]
  ];
  return {
    inv,
    ped,
    otif,
    cau: C.map(c => ({ causa: c[0], etapa: c[1], frecuencia: c[2] })),
    demo: 1
  };
}

// ===== Estado y carga =====
let LAY = defLayout(),
  DB = { inv: [], ped: [], otif: [], cau: [], demo: 0 },
  AJ = { ...AJ0 },
  TAB = {},
  C = {};
const save = () => {
  try {
    localStorage.setItem('axl', JSON.stringify({ DB, AJ, lay: LAY }));
  } catch (e) {}
};
try {
  const s = JSON.parse(localStorage.getItem('axl'));
  if (s) {
    DB = s.DB;
    AJ = { ...AJ0, ...s.AJ };
    LAY = s.lay || LAY;
  }
} catch (e) {}
function ingest(txt, name = '') {
  txt = txt.trim();
  let k;
  if (txt[0] == '{') {
    try {
      const j = JSON.parse(txt);
      if (j.nodos && j.aristas) {
        LAY = j;
        k = 'el layout';
      }
    } catch (e) {
      return 'JSON no válido';
    }
  } else {
    const o = toObjs(txt),
      h = Object.keys(o[0] || {});
    const t = h.includes('pedidoid')
      ? 'ped'
      : h.includes('stocksistema')
        ? 'inv'
        : h.includes('pedidosotif')
          ? 'otif'
          : h.includes('causa')
            ? 'cau'
            : null;
    if (!t) return 'No reconozco las columnas. Usa las plantillas.';
    DB[t] = o;
    DB.demo = 0;
    k = t + ' (' + o.length + ' filas)';
  }
  graph();
  save();
  calc();
  return 'Cargado: ' + k;
}

// ===== Cálculos =====
function calc() {
  const A = AJ,
    inv = DB.inv,
    ped = DB.ped;
  C = {};
  const lt = { SECO: A.ltS, FRIO: A.ltF, CONGELADO: A.ltC };
  // demanda, frecuencia
  const mx = ped.length ? Math.max(...ped.map(p => +new Date(p.fecha))) : Date.now(),
    d0 = mx - A.vent * 864e5,
    dem = {},
    fr = {};
  ped.forEach(p => {
    if (+new Date(p.fecha) >= d0) {
      dem[p.sku] = (dem[p.sku] || 0) + num(p.cantidad);
      fr[p.sku] = (fr[p.sku] || 0) + 1;
    }
  });
  const ords = {};
  ped.forEach(p =>
    (ords[p.pedidoid] = ords[p.pedidoid] || {
      id: p.pedidoid,
      cli: p.cliente,
      tienda: p.tienda,
      fecha: p.fecha,
      l: []
    }).l.push(p)
  );
  C.ords = Object.values(ords).sort((a, b) => b.fecha.localeCompare(a.fecha));
  C.nped = C.ords.length;
  C.lineas = ped.length;
  C.sk = inv.map(s => {
    const o = {
      sku: s.sku,
      desc: s.descripcion,
      cli: s.cliente,
      um: s.um,
      cost: num(s.costounitario),
      sys: num(s.stocksistema),
      ph: num(s.stockfisico),
      rack: s.rack,
      zona: s.zona,
      vol: num(s.volumenm3) || 0.005,
      d: (dem[s.sku] || 0) / A.vent,
      f: fr[s.sku] || 0
    };
    o.lt = lt[o.zona] || 3;
    return o;
  });
  const tot = sum(C.sk, s => s.f) || 1;
  let cum = 0;
  [...C.sk]
    .sort((a, b) => b.f - a.f)
    .forEach(s => {
      const pv = cum / tot;
      cum += s.f;
      s.abc = pv < 0.8 ? 'A' : pv < 0.95 ? 'B' : 'C';
    });
  // reposición
  C.rep = (z, dv, dl) =>
    C.sk.map(s => {
      const d = s.d * (1 + dv),
        L = s.lt + dl,
        ss = z * A.cv * d * Math.sqrt(L),
        rop = d * L + ss,
        q = Math.max(0, d * (L + A.ciclo) + ss - s.sys);
      return {
        ...s,
        ss,
        rop,
        cob: d ? s.sys / d : 999,
        q: Math.ceil(q),
        inv: Math.ceil(q) * s.cost,
        st: s.sys <= rop ? 'PEDIR' : s.sys <= rop * 1.3 ? 'PRONTO' : 'OK'
      };
    });
  C.R = C.rep(ZV[A.z] || 1.645, 0, 0);
  C.pedir = C.R.filter(s => s.st == 'PEDIR');
  C.pronto = C.R.filter(s => s.st == 'PRONTO').length;
  // ERI
  C.dif = C.sk.filter(s => s.sys != s.ph);
  C.eri = C.sk.length ? 1 - C.dif.length / C.sk.length : 0;
  C.eriV =
    1 - sum(C.dif, s => Math.abs(s.sys - s.ph) * s.cost) / (sum(C.sk, s => s.sys * s.cost) || 1);
  C.falt = C.dif.filter(s => s.ph < s.sys).length;
  C.sobr = C.dif.length - C.falt;
  C.net = sum(C.dif, s => (s.ph - s.sys) * s.cost);
  C.invVal = sum(C.sk, s => s.sys * s.cost);
  // OTIF
  C.m = DB.otif.map(o => {
    const t = num(o.pedidostotal),
      v = num(o.pedidosotif);
    return {
      mes: mlab(o.mes),
      otif: t ? (v / t) * 100 : 0,
      t,
      v,
      cj: num(o.cajasentregadas),
      cp: num(o.cajaspedidas),
      inc: o.incidencias === '' ? null : num(o.incidencias),
      par: t < 100
    };
  });
  const F = C.m.filter(m => !m.par);
  C.F = F;
  C.otifAvg = F.length ? sum(F, m => m.otif) / F.length : 0;
  C.bajo = F.filter(m => m.otif < A.meta).length;
  const R = F.filter(m => m.inc != null),
    n = R.length;
  let sl = -0.17,
    ic = 100;
  if (n > 2) {
    const mx = sum(R, m => m.inc) / n,
      my = sum(R, m => m.otif) / n,
      sxy = sum(R, m => (m.inc - mx) * (m.otif - my)),
      sxx = sum(R, m => (m.inc - mx) ** 2),
      syy = sum(R, m => (m.otif - my) ** 2);
    sl = sxy / sxx;
    ic = my - sl * mx;
    C.r2 = (sxy * sxy) / (sxx * syy || 1);
    C.incAvg = mx;
  } else {
    C.r2 = 0;
    C.incAvg = 0;
  }
  C.sl = sl;
  C.ic = ic;
  C.R_ = R;
  C.cj = sum(F, m => m.cj) / (sum(F, m => m.cp) || 1);
  C.fuera = sum(F, m => m.t - m.v);
  C.tot = sum(F, m => m.t);
  C.cauT = sum(DB.cau, c => num(c.frecuencia)) || 1;
  // slotting
  const rk = racks(),
    dd = D.DOCK || {};
  C.dist = r => dd[r] ?? 0;
  const cap = {},
    tv = sum(C.sk, s => s.vol * s.sys);
  rk.forEach(r => (cap[r.id] = tv / rk.length / 0.55));
  C.cap = cap;
  const occ = map => {
    const o = {};
    rk.forEach(r => (o[r.id] = 0));
    C.sk.forEach(s => {
      if (o[map[s.sku]] != null) o[map[s.sku]] += s.vol * s.sys;
    });
    for (const k in o) o[k] /= cap[k];
    return o;
  };
  const cur = {},
    nw = {};
  C.sk.forEach(s => (cur[s.sku] = s.rack));
  const used = {};
  rk.forEach(r => (used[r.id] = 0));
  const prop = {};
  ['SECO', 'FRIO', 'CONGELADO'].forEach(z => {
    const rs = rk.filter(r => r.zona == z).sort((a, b) => C.dist(a.id) - C.dist(b.id));
    if (!rs.length) return;
    C.sk
      .filter(s => s.zona == z)
      .sort((a, b) => a.vol / (a.f || 0.1) - b.vol / (b.f || 0.1))
      .forEach(s => {
        const w = s.vol * s.sys;
        let r =
          rs.find(r => used[r.id] + w <= cap[r.id]) ||
          rs.reduce((m, r) => (used[r.id] < used[m.id] ? r : m));
        used[r.id] += w;
        prop[s.sku] = r.id;
      });
  });
  C.mov = [];
  let ahorro = 0;
  C.sk.forEach(s => {
    const rc = NID[s.rack],
      t = rc ? rc.zona != s.zona : false,
      pn = prop[s.sku];
    if (!pn) return;
    const mej = C.dist(s.rack) - C.dist(pn);
    nw[s.sku] = s.rack;
    if (pn != s.rack && (t || mej >= A.minMej)) {
      nw[s.sku] = pn;
      const w = (s.f / A.vent) * 7 * 2 * Math.max(mej, 0);
      ahorro += w;
      C.mov.push({ ...s, pn, mej, t, w, pr: t ? 'Crítica' : s.abc == 'A' ? 'Alta' : 'Media' });
    }
  });
  C.mov.sort(
    (a, b) =>
      (a.pr == 'Crítica' ? 0 : a.pr == 'Alta' ? 1 : 2) -
        (b.pr == 'Crítica' ? 0 : b.pr == 'Alta' ? 1 : 2) || b.w - a.w
  );
  C.ahorro = ahorro;
  C.termico = C.mov.filter(m => m.t).length;
  C.cur = cur;
  C.nw = nw;
  C.occ0 = occ(cur);
  C.occ1 = occ(nw);
  C.sobre0 = Object.values(C.occ0).filter(x => x > 1).length;
  C.sobre1 = Object.values(C.occ1).filter(x => x > 1).length;
  C.skm = Object.fromEntries(C.sk.map(s => [s.sku, s]));
}

// ===== Rutas =====
const ZO = ['SECO', 'FRIO', 'CONGELADO'];
function perms(a) {
  if (a.length < 2) return [a];
  return a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
}
const seqLen = s => {
  let d = 0;
  for (let i = 1; i < s.length; i++) d += D[s[i - 1]][s[i]] ?? 0;
  return d;
};
function route(o, metodo, map) {
  const L = o.l.filter(l => C.skm[l.sku] && map[l.sku] && NID[map[l.sku]]),
    rs = [...new Set(L.map(l => map[l.sku]))];
  let st;
  if (metodo == 'lista') {
    const f = [];
    [...L]
      .sort((a, b) => a.sku.localeCompare(b.sku))
      .forEach(l => {
        if (!f.includes(map[l.sku])) f.push(map[l.sku]);
      });
    st = f;
  } else if (metodo == 'vecino') {
    st = [];
    let c = 'DOCK',
      r = [...rs];
    while (r.length) {
      r.sort((a, b) => D[c][a] - D[c][b]);
      c = r.shift();
      st.push(c);
    }
  } else {
    st = [];
    let c = 'DOCK';
    ZO.forEach(z => {
      const g = rs.filter(r => NID[r].zona == z);
      if (!g.length) return;
      const ps = g.length <= 7 ? perms(g) : [g.sort((a, b) => D[c][a] - D[c][b])];
      let b = null,
        bd = 1e9;
      ps.forEach(p => {
        const d = seqLen([c, ...p]);
        if (d < bd) {
          bd = d;
          b = p;
        }
      });
      st.push(...b);
      c = b[b.length - 1];
    });
  }
  const seq = ['DOCK', ...st, 'DOCK'],
    dist = seqLen(seq),
    t = dist / AJ.vel + L.length * AJ.tpl,
    cold = st.map((r, i) => (NID[r].zona != 'SECO' ? i : -1)).filter(i => i >= 0);
  let ce = 0;
  if (cold.length) {
    const a = cold[0] + 1,
      b = cold[cold.length - 1] + 1;
    ce =
      seqLen(seq.slice(a, b + 1)) / AJ.vel +
      L.filter(l => NID[map[l.sku]].zona != 'SECO').length * AJ.tpl;
  }
  const hoja = [];
  st.forEach((r, i) =>
    L.filter(l => map[l.sku] == r).forEach(l =>
      hoja.push([i + 1, r, NID[r].zona, l.sku, C.skm[l.sku].desc, l.cantidad])
    )
  );
  return { st, seq, dist, t, ce, hoja, nl: L.length };
}
const mmss = s => Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';

// ===== Dibujo del plano =====
function plan(o = {}) {
  const Z = LAY.zonas,
    cl = {
      SECO: ['#fef3c7', '#f59e0b'],
      FRIO: ['#e0f2fe', '#38bdf8'],
      CONGELADO: ['#e0e7ff', '#818cf8']
    },
    Y = y => 38 - y;
  let s =
    '<svg viewBox="0 0 82 40" style="background:#fff;border:1px solid #e2e6ee;border-radius:10px">';
  for (const z in Z) {
    const q = Z[z];
    s += `<rect x="${q.x0}" y="${Y(q.y1)}" width="${q.x1 - q.x0}" height="${q.y1 - q.y0}" rx="1.2" fill="${cl[z][0]}" stroke="${cl[z][1]}" stroke-width=".25"/><text x="${q.x0 + 1}" y="${Y(q.y1) + 2}" font-size="1.5" font-weight="700" fill="#475569">${z} · ${q.temp}</text>`;
  }
  LAY.aristas.forEach(([a, b]) => {
    if (NID[a] && NID[b])
      s += `<line x1="${NID[a].x}" y1="${Y(NID[a].y)}" x2="${NID[b].x}" y2="${Y(NID[b].y)}" stroke="#cbd5e1" stroke-width="1.4" stroke-linecap="round"/>`;
  });
  LAY.nodos.forEach(n => {
    if (n.tipo == 'muelle')
      s += `<rect x="${n.x - 2.5}" y="${Y(n.y) - 2}" width="5" height="4" rx=".5" fill="#16a34a"/><text x="${n.x}" y="${Y(n.y) + 0.5}" font-size="1.1" fill="#fff" text-anchor="middle" font-weight="700">MUELLE</text>`;
    if (n.tipo == 'rack') {
      const p = o.occ ? o.occ[n.id] : null,
        hot = p > 1;
      s += `<rect x="${n.x - 2.2}" y="${Y(n.y) - 1.6}" width="4.4" height="3.2" rx=".4" fill="${p == null ? '#fff' : `rgba(${n.zona == 'SECO' ? '245,158,11' : n.zona == 'FRIO' ? '56,189,248' : '99,102,241'},${Math.min(0.15 + p * 0.6, 0.95)})`}" stroke="${hot ? '#dc2626' : cl[n.zona][1]}" stroke-width="${hot ? 0.35 : 0.2}"/><text x="${n.x}" y="${Y(n.y) - 0.1}" font-size=".95" text-anchor="middle">${n.id}</text>${p != null ? `<text x="${n.x}" y="${Y(n.y) + 1}" font-size=".95" text-anchor="middle" font-weight="700">${Math.round(p * 100)} %</text>` : ''}`;
    }
  });
  if (o.seq) {
    const pts = [];
    for (let i = 1; i < o.seq.length; i++)
      path(o.seq[i - 1], o.seq[i]).forEach((n, j) => {
        if (j || !i || 1) pts.push(`${NID[n].x},${Y(NID[n].y)}`);
      });
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width=".45" stroke-dasharray=".9 .5"/>`;
    o.st.forEach(
      (r, i) =>
        (s += `<circle cx="${NID[r].x - 2.2}" cy="${Y(NID[r].y) - 1.6}" r="1" fill="#f97316"/><text x="${NID[r].x - 2.2}" y="${Y(NID[r].y) - 1.25}" font-size="1.1" fill="#fff" text-anchor="middle" font-weight="700">${i + 1}</text>`)
    );
  }
  return s + '</svg>';
}
function lineChart(m, meta) {
  if (!m.length) return '';
  const W = 640,
    H = 230,
    p = 36,
    mn = Math.min(80, ...m.map(x => x.otif)) - 1,
    mxv = 100,
    X = i => p + (i * (W - p - 10)) / Math.max(m.length - 1, 1),
    Y = v => H - 24 - ((v - mn) / (mxv - mn)) * (H - 40);
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  for (let v = Math.ceil(mn / 5) * 5; v <= 100; v += 5)
    s += `<line x1="${p}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef1f6"/><text x="${p - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="#667085">${v}</text>`;
  s += `<line x1="${p}" x2="${W}" y1="${Y(meta)}" y2="${Y(meta)}" stroke="#16a34a" stroke-dasharray="6 4"/><text x="${p + 4}" y="${Y(meta) - 4}" font-size="11" fill="#16a34a">Meta ${meta} %</text><polyline fill="none" stroke="#2563eb" stroke-width="2" points="${m
    .filter(x => !x.par)
    .map(x => X(m.indexOf(x)) + ',' + Y(x.otif))
    .join(' ')}"/>`;
  m.forEach(
    (x, i) =>
      (s += `<circle cx="${X(i)}" cy="${Y(x.otif)}" r="4.5" fill="${x.par ? '#fff' : x.otif >= meta ? '#16a34a' : '#dc2626'}" stroke="${x.par ? '#94a3b8' : 'none'}"><title>${x.mes}: ${fmt(x.otif, 1)} %</title></circle><text x="${X(i)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#475569">${x.mes}</text>`)
  );
  return s + '</svg>';
}
const bars = (rows, color) => {
  const mx = Math.max(...rows.map(r => r[1]), 1);
  return rows
    .map(
      r =>
        `<div class="bar"><span>${r[0]}</span><div><i style="width:${(r[1] / mx) * 100}%;background:${r[2] || color}"></i></div><b>${r[3]}</b></div>`
    )
    .join('');
};

// ===== Vistas =====
const MENU = [
  ['panel', 'Panel', '⌂', '#3b82f6'],
  ['h', 'DATOS'],
  ['datos', 'Datos', '▤', '#14b8a6'],
  ['h', 'ANÁLISIS'],
  ['diag', 'Diagnóstico OTIF', '∿', '#a855f7'],
  ['h', 'MÓDULOS'],
  ['ubic', 'Ubicaciones', '▦', '#f59e0b'],
  ['pick', 'Picking', '⇢', '#06b6d4'],
  ['inv', 'Inventario y compras', '▣', '#22c55e'],
  ['h', 'SIMULACIÓN'],
  ['esc', 'Escenarios', '⚙', '#ec4899'],
  ['aju', 'Ajustes', '⚒', '#64748b']
];
const head = (t, s, x = '') =>
  `<div class="top"><div><h1>${t}</h1><p class="sub">${s}</p></div><div class="row">${x}</div></div>`;
const V = {};
V.panel = () => {
  const ur = C.pedir.length,
    mt = C.F.length ? C.F.reduce((m, x) => (x.otif < m.otif ? x : m)) : { mes: '-', otif: 0 },
    mj = C.F.length ? C.F.reduce((m, x) => (x.otif > m.otif ? x : m)) : { mes: '-', otif: 0 };
  return (
    head('Panel de control', 'Resumen de la operación y lo que conviene hacer hoy.') +
    `<div class="grid">${kpi('OTIF promedio (meses completos)', fmt(C.otifAvg, 1) + ' %', `Meta ${AJ.meta} % · ${fmt(C.otifAvg - AJ.meta, 1)} pp`, C.otifAvg < AJ.meta ? 'er' : 'ok')}${kpi('Exactitud de inventario (ERI)', pc(C.eri), `${C.sk.length - C.dif.length} de ${C.sk.length} SKUs sin diferencia`, C.eri * 100 < AJ.eri ? 'er' : 'ok')}${kpi('SKUs a reponer hoy', ur, 'Inversión ' + sol(sum(C.pedir, s => s.inv)), 'er')}${kpi('Traslados sugeridos', C.mov.length, C.termico + ' críticos por riesgo térmico', 'wa')}${kpi('Valor del inventario', sol(C.invVal), C.sk.length + ' SKUs activos')}</div>
<div class="grid g2"><div class="card"><h2>Tendencia histórica del OTIF</h2>${lineChart(C.m, AJ.meta)}</div><div class="card"><h2>Desglose del OTIF</h2><p class="mu">OTIF = pedidos entregados a tiempo (On Time) y completos (In Full) a la vez.</p>${bars(
      [
        ['In Full (cajas)', C.cj * 100, '#2563eb', fmt(C.cj * 100, 2) + ' %'],
        ['OTIF', C.otifAvg, C.otifAvg < AJ.meta ? '#dc2626' : '#16a34a', fmt(C.otifAvg, 1) + ' %']
      ],
      '#2563eb'
    )}<p>${fmt(C.fuera)} de ${fmt(C.tot)} pedidos quedaron fuera del OTIF.</p><p class="mu">Mejor mes: <b>${mj.mes} · ${fmt(mj.otif, 1)} %</b><br>Peor mes: <b>${mt.mes} · ${fmt(mt.otif, 1)} %</b><br>Meses bajo la meta: <b>${C.bajo} de ${C.F.length}</b></p></div></div>
<h2>Tareas ordenadas por urgencia</h2><div class="grid g2"><div class="card task"><big style="color:var(--er)">${ur}</big><div><b>Generar pedidos de reposición</b><p class="mu">SKUs en o bajo su punto de reorden. Otros ${C.pronto} lo estarán pronto.</p><button class="btn r" data-go="inv">Ver plan de compras →</button></div></div><div class="card task"><big style="color:var(--er)">${C.termico}</big><div><b>Trasladar productos mal ubicados</b><p class="mu">Productos fuera de su cámara: trasladarlos primero.</p><button class="btn r" data-go="ubic">Ver traslados →</button></div></div><div class="card task a"><big style="color:var(--wa)">${Math.min(40, C.dif.length)}</big><div><b>Conteo cíclico de la semana</b><p class="mu">Hay ${C.dif.length} SKUs con diferencia entre sistema y físico: se cuentan primero.</p><button class="btn o" data-go="inv" data-tab="2">Ver lista de conteo →</button></div></div><div class="card task b"><big style="color:var(--ac)">→</big><div><b>Armar un pedido con la mejor ruta</b><p class="mu">Elija un pedido, vea el recorrido y descargue la hoja de picking.</p><button class="btn p" data-go="pick">Ir a Picking →</button></div></div></div>
<div class="card"><h2>Estado de los datos</h2>${DB.demo ? '<span class="tag t-a">Inventario y pedidos: sintético</span> ' : '<span class="tag t-g">Inventario y pedidos: cargados</span> '}<span class="tag t-g">OTIF: ${DB.otif.length} meses</span> <span class="tag t-g">Causas: ${DB.cau.length}</span> <button class="btn" data-go="datos">Gestionar datos</button><p class="mu">Demanda calculada con ${fmt(C.nped)} pedidos de los últimos ${AJ.vent} días.</p></div>`
  );
};
V.datos = () => {
  const card = (t, d, st) =>
    `<div class="card"><h2>${t}</h2><p class="mu">${d}</p><p class="${st ? 'ok2' : 'mu'}">${st || 'Sin datos'}</p></div>`;
  return (
    head(
      'Datos',
      'Cargue sus archivos o pruebe con datos de ejemplo. Todo se guarda en este navegador.',
      `<button class="btn p" id="bdemo">▷ Usar datos de ejemplo</button>`
    ) +
    `<div class="card" style="background:#e0f2fe"><b>Consejo:</b> arrastre y suelte los archivos sobre la página; el sistema reconoce de qué tipo son. Acepta CSV (coma o punto y coma), layout JSON, enlaces de Google Sheets y datos pegados.</div>
<div class="row"><input type="file" id="fi" accept=".csv,.txt,.json" multiple><button class="btn" id="bpaste">🔗 Pegar o enlace…</button><button class="btn" id="bexp">⬇ Exportar copia</button><button class="btn" id="bclr">Borrar todo</button></div><p id="msg" class="ok2"></p>
<div class="grid g2">${card('Layout de la planta', 'Red de racks y pasillos (.json). Si no carga, se usa un plano referencial.', `${racks().length} racks · ${LAY.nombre}`)}${card('Inventario', 'Obligatorio: SKU y Stock_Sistema. Recomendado: Descripcion, Costo_Unitario, Stock_Fisico, Rack, Zona, UM, Volumen_m3.', DB.inv.length && DB.inv.length + ' SKUs')}${card('Pedidos históricos', 'Obligatorio: Pedido_ID, Fecha, SKU, Cantidad.', DB.ped.length && `${fmt(C.nped)} pedidos y ${fmt(DB.ped.length)} líneas`)}${card('OTIF mensual', 'Obligatorio: Mes, Pedidos_OTIF, Pedidos_Total. Opcional: Cajas_Entregadas, Cajas_Pedidas, Incidencias.', DB.otif.length && DB.otif.length + ' meses')}${card('Causas de incidencias', 'Causa, Etapa (Recepción, Picking, Distribución), Frecuencia.', DB.cau.length && DB.cau.length + ' causas')}</div>`
  );
};
V.diag = () => {
  const R = C.R_,
    W = 520,
    H = 300,
    p = 44,
    xs = R.map(m => m.inc),
    x0 = Math.min(...xs, 20) - 5,
    x1 = Math.max(...xs, 80) + 5,
    y0 = Math.min(...R.map(m => m.otif), 84) - 1,
    y1 = 99,
    X = v => p + ((v - x0) / (x1 - x0)) * (W - p - 10),
    Y = v => H - 36 - ((v - y0) / (y1 - y0)) * (H - 50);
  let sc = `<svg viewBox="0 0 ${W} ${H}"><line x1="${p}" x2="${W}" y1="${Y(AJ.meta)}" y2="${Y(AJ.meta)}" stroke="#16a34a" stroke-dasharray="6 4"/><line x1="${X(x0)}" y1="${Y(C.ic + C.sl * x0)}" x2="${X(x1)}" y2="${Y(C.ic + C.sl * x1)}" stroke="#dc2626" stroke-width="2"/>`;
  R.forEach(
    m =>
      (sc += `<circle cx="${X(m.inc)}" cy="${Y(m.otif)}" r="5" fill="#2563eb"/><text x="${X(m.inc) + 6}" y="${Y(m.otif) - 6}" font-size="10">${m.mes}</text>`)
  );
  sc += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="12" font-weight="700">Incidencias de almacén en el mes</text></svg>`;
  const et = {};
  DB.cau.forEach(c => (et[c.etapa] = (et[c.etapa] || 0) + num(c.frecuencia)));
  const ata = n => /ubicacion|diferencia|falta de prod/.test(norm(n));
  const cum = (() => {
    let a = 0;
    return DB.cau.map(c => {
      a += num(c.frecuencia);
      return a / C.cauT;
    });
  })();
  const need = C.sl ? (AJ.meta - C.ic) / C.sl : 0;
  return (
    head(
      'Diagnóstico OTIF',
      '¿Qué tan bien cumplimos y por qué falla? Evolución, efecto de las incidencias y causas que más pesan.'
    ) +
    `<div class="grid">${kpi('OTIF promedio', fmt(C.otifAvg, 1) + ' %', `${fmt(C.otifAvg - AJ.meta, 1)} pp frente a la meta`, 'er')}${kpi('Meses bajo la meta', C.bajo + ' de ' + C.F.length, '', 'er')}${kpi('Incidencias en picking', fmt(((et['Picking'] || 0) / C.cauT) * 100, 1) + ' %', 'Etapa donde más se puede mejorar')}${kpi('Relación incidencias ↔ OTIF', 'R² = ' + fmt(C.r2 * 100, 0) + ' %', `Pendiente ${fmt(C.sl, 3)} pp por incidencia`)}${kpi('In Full (Fill Rate)', fmt(C.cj * 100, 2) + ' %', 'Cajas entregadas ÷ pedidas', 'ok')}</div>
<div class="card"><h2>Evolución mensual del OTIF</h2>${lineChart(C.m, AJ.meta)}</div>
<div class="grid g2"><div class="card"><h2>¿Las incidencias explican el OTIF?</h2>${sc}<p class="mu">Recta: OTIF = ${fmt(C.ic, 2)} ${fmt(C.sl, 4)} × incidencias. Para alcanzar ${AJ.meta} % harían falta unas <b>${fmt(need)}</b> incidencias/mes (hoy ${fmt(C.incAvg)}).</p></div>
<div class="card"><h2>Causas de las incidencias (Pareto)</h2>${bars(DB.cau.map((c, i) => [c.causa, num(c.frecuencia), ata(c.causa) ? '#16a34a' : '#94a3b8', `${fmt(num(c.frecuencia))} · ${pc(num(c.frecuencia) / C.cauT)} (acum. ${pc(cum[i], 0)})`]))}<p class="mu">Verde: causas que atacan los módulos. Por etapa: ${Object.entries(
      et
    )
      .map(([k, v]) => tag('t-b', k + ' ' + pc(v / C.cauT)))
      .join(' ')}</p></div></div>
<div class="card"><h2>Detalle mensual</h2>${tbl(
      [
        'Mes',
        'Estado',
        'Pedidos OTIF',
        'Pedidos totales',
        'OTIF',
        'Cajas entregadas',
        'Incidencias'
      ],
      C.m.map(m => [
        m.mes,
        m.par
          ? tag('t-b', 'Parcial')
          : m.otif < AJ.meta
            ? tag('t-r', 'Bajo meta')
            : tag('t-g', 'Cumple'),
        fmt(m.v),
        fmt(m.t),
        '<b>' + fmt(m.otif, 1) + ' %</b>',
        fmt(m.cj),
        m.inc ?? '—'
      ])
    )}</div>`
  );
};
V.ubic = () => {
  const t = TAB.u || 1,
    f = TAB.uf || '';
  const rows = C.mov.filter(m => !f || (m.sku + m.desc).toLowerCase().includes(f.toLowerCase()));
  return (
    head(
      'Ubicaciones (Slotting)',
      'Ubique cerca del muelle lo que más se pide y mantenga cada producto en su cámara.',
      `<button class="btn" id="bexp">⬇ Exportar plan</button>`
    ) +
    `<div class="grid">${kpi('Traslados sugeridos', C.mov.length, `de ${C.sk.length} SKUs (${fmt((C.mov.length / (C.sk.length || 1)) * 100, 0)} %)`, 'wa')}${kpi('Riesgo térmico', C.termico, 'productos fuera de su cámara', 'er')}${kpi('Ahorro estimado', fmt(C.ahorro) + ' m/sem', 'metros de recorrido si se aplican todos')}${kpi('Racks sobre su capacidad', C.sobre0, 'Con el plan: ' + C.sobre1, 'wa')}${kpi('SKUs sin ubicación', C.sk.filter(s => !NID[s.rack]).length, '', 'ok')}</div>
<div class="tabs"><button class="${t == 1 ? 'on' : ''}" data-t="u1">Plan de traslados</button><button class="${t == 2 ? 'on' : ''}" data-t="u2">Plano de la planta</button></div>` +
    (t == 1
      ? `<div class="card"><div class="row"><input id="uf" placeholder="Buscar por SKU o producto…" value="${f}"></div><p class="mu">Mostrando ${rows.length} de ${C.sk.length} SKUs</p>${tbl(
          [
            'Prioridad',
            'SKU',
            'Producto',
            'Cliente',
            'Zona',
            'ABC',
            'Rack actual',
            'Rack propuesto',
            'Mejora (m)'
          ],
          rows.map(m => [
            tag(m.pr == 'Crítica' ? 't-r' : m.pr == 'Alta' ? 't-a' : 't-b', m.pr),
            m.sku,
            m.desc,
            m.cli,
            zt(m.zona),
            m.abc,
            '<b>' + m.rack + '</b>',
            '<b>' + m.pn + '</b>',
            fmt(m.mej)
          ])
        )}</div>`
      : `<div class="card"><div class="row"><h2 style="flex:1">Ocupación de racks</h2><button class="btn ${TAB.o ? '' : 'p'}" data-o="0">Situación actual</button><button class="btn ${TAB.o ? 'p' : ''}" data-o="1">Con el plan aplicado</button></div>${plan({ occ: TAB.o ? C.occ1 : C.occ0 })}</div>`)
  );
};
V.pick = () => {
  const os = C.ords.slice(0, 400),
    sel = TAB.po || (os[0] && os[0].id),
    o = os.find(x => x.id == sel) || os[0];
  if (!o) return head('Picking · Rutas', 'Cargue pedidos en Datos.');
  const map = TAB.pp ? C.nw : C.cur,
    me = TAB.pm || 'zonas',
    r = route(o, me, map),
    all = ['lista', 'vecino', 'zonas'].map(m => [m, route(o, m, map)]),
    base = all[0][1].dist,
    NM = {
      lista: 'Lista impresa (orden por código de SKU)',
      vecino: 'Vecino más cercano (sobre el grafo)',
      zonas: 'Óptimo por zonas (cadena de frío)'
    };
  return (
    head(
      'Picking · Rutas',
      'Elija un pedido y el sistema calcula el recorrido respetando la cadena de frío: muelle → seco → frío → congelado → muelle.'
    ) +
    `<div class="grid g2"><div><div class="card"><h2>1 · Elija el pedido</h2><select id="po" style="width:100%">${os.map(x => `<option value="${x.id}" ${x.id == o.id ? 'selected' : ''}>${x.id} · ${x.tienda} · ${x.l.length} líneas</option>`).join('')}</select><p class="mu">Se muestran los 400 más recientes.</p></div>
<div class="card"><h2>2 · Método y ubicaciones</h2><select id="pm" style="width:100%">${Object.entries(
      NM
    )
      .map(([k, v]) => `<option value="${k}" ${k == me ? 'selected' : ''}>${v}</option>`)
      .join(
        ''
      )}</select><div class="tabs" style="margin-top:8px"><button class="${TAB.pp ? '' : 'on'}" data-p="0">Ubicaciones actuales</button><button class="${TAB.pp ? 'on' : ''}" data-p="1">Con plan aplicado</button></div></div>
<div class="grid">${kpi('Distancia total', fmt(r.dist) + ' m', 'ida y vuelta al muelle')}${kpi('Tiempo de armado', mmss(r.t), AJ.vel + ' m/s + ' + AJ.tpl + ' s por línea')}${kpi('Exposición al frío', mmss(r.ce), `Límite ${AJ.frioMax} min · ${r.ce / 60 <= AJ.frioMax ? 'dentro' : 'EXCEDIDO'}`, r.ce / 60 <= AJ.frioMax ? 'ok' : 'er')}${kpi('Paradas y líneas', r.st.length + ' / ' + r.nl, 'racks a visitar / líneas')}</div></div>
<div class="card"><h2>Recorrido en la planta</h2>${plan({ seq: r.seq, st: r.st })}</div></div>
<div class="card"><h2>Comparar métodos para este pedido</h2>${tbl(
      ['Método', 'Distancia (m)', 'Tiempo', 'vs. lista', 'Mejor'],
      all.map(([m, x]) => [
        NM[m],
        fmt(x.dist),
        mmss(x.t),
        m == 'lista' ? '—' : fmt((x.dist / base - 1) * 100, 1) + ' %',
        x.dist == Math.min(...all.map(a => a[1].dist)) ? tag('t-g', '★ Mejor') : ''
      ])
    )}</div>
<div class="card"><div class="row"><h2 style="flex:1">Hoja de picking</h2><button class="btn p" id="bexp">⬇ Exportar CSV</button><button class="btn" onclick="print()">Guardar PDF</button></div>${tbl(
      ['Paso', 'Rack', 'Zona', 'SKU', 'Producto', 'Cantidad'],
      r.hoja.map(h => [h[0], '<b>' + h[1] + '</b>', zt(h[2]), h[3], h[4], h[5]])
    )}</div>`
  );
};
V.inv = () => {
  const t = TAB.i || 1;
  let b = '';
  if (t == 1)
    b = tbl(
      [
        'Decisión',
        'Cuándo pedir',
        'SKU',
        'Producto',
        'Zona',
        'Un.',
        'Stock',
        'Cobertura (días)',
        'Stock seguridad',
        'Punto reorden',
        'Cantidad a pedir',
        'Inversión'
      ],
      C.R.filter(s => s.st != 'OK')
        .sort((a, b) => (a.st == 'PEDIR' ? 0 : 1) - (b.st == 'PEDIR' ? 0 : 1) || a.cob - b.cob)
        .map(s => [
          tag(s.st == 'PEDIR' ? 't-r' : 't-a', s.st == 'PEDIR' ? 'PEDIR HOY' : 'PRONTO'),
          s.st == 'PEDIR' ? 'Hoy' : 'Esta semana',
          s.sku,
          s.desc,
          zt(s.zona),
          s.um,
          fmt(s.sys),
          fmt(s.cob, 1),
          fmt(s.ss),
          fmt(s.rop),
          fmt(s.q),
          sol(s.inv)
        ])
    );
  if (t == 2)
    b = tbl(
      ['SKU', 'Producto', 'Zona', 'Sistema', 'Físico', 'Diferencia', 'Valor dif.', 'Rack'],
      [...C.dif]
        .sort((a, b) => Math.abs(b.ph - b.sys) * b.cost - Math.abs(a.ph - a.sys) * a.cost)
        .map(s => [
          s.sku,
          s.desc,
          zt(s.zona),
          fmt(s.sys),
          fmt(s.ph),
          `<b class="${s.ph < s.sys ? 'wn' : 'ok2'}">${s.ph - s.sys > 0 ? '+' : ''}${s.ph - s.sys}</b>`,
          sol((s.ph - s.sys) * s.cost),
          s.rack
        ])
    );
  if (t == 3)
    b =
      `<p class="mu">Se cuentan primero los SKUs con diferencia y mayor valor, luego los de alta rotación (clase A).</p>` +
      tbl(
        ['Orden', 'SKU', 'Producto', 'Rack', 'Motivo', 'ABC'],
        [
          ...C.dif.map(s => [s, 'Diferencia sistema/físico']),
          ...C.sk.filter(s => s.abc == 'A' && s.sys == s.ph).map(s => [s, 'Alta rotación'])
        ]
          .slice(0, 40)
          .map(([s, m], i) => [i + 1, s.sku, s.desc, s.rack, m, s.abc])
      );
  return (
    head(
      'Inventario y compras',
      'Qué reponer, cuánto pedir y qué contar esta semana.',
      `<button class="btn p" id="bexp">⬇ Exportar pestaña actual</button>`
    ) +
    `<div class="grid">${kpi('ERI por SKU', pc(C.eri), `Meta ${AJ.eri} % · ${C.sk.length - C.dif.length} de ${C.sk.length} sin diferencia`, C.eri * 100 < AJ.eri ? 'er' : 'ok')}${kpi('ERI valorizado', pc(C.eriV), 'Diferencia absoluta ' + sol(sum(C.dif, s => Math.abs(s.sys - s.ph) * s.cost)))}${kpi('Faltantes / sobrantes', C.falt + ' / ' + C.sobr, 'Neto ' + sol(C.net), 'wa')}${kpi('SKUs a reponer hoy', C.pedir.length, C.pronto + ' más pronto', 'er')}${kpi('Inversión inmediata', sol(sum(C.pedir, s => s.inv)), 'para cubrir lo urgente')}</div><div class="tabs"><button class="${t == 1 ? 'on' : ''}" data-i="1">Plan de compras</button><button class="${t == 2 ? 'on' : ''}" data-i="2">Diferencias de inventario (${C.dif.length})</button><button class="${t == 3 ? 'on' : ''}" data-i="3">Conteo cíclico semanal</button></div><div class="card">${b}</div>`
  );
};
V.esc = () => {
  const ords = C.ords.slice(0, 100),
    ev = map => {
      const r = ords.map(o => route(o, 'zonas', map)),
        n = r.length || 1;
      return {
        d: sum(r, x => x.dist) / n,
        t: sum(r, x => x.t) / n,
        c: sum(r, x => x.ce) / n,
        ex: r.filter(x => x.ce / 60 > AJ.frioMax).length / n
      };
    },
    a = ev(C.cur),
    b = ev(C.nw),
    ro = ords.map(o => route(o, 'vecino', C.cur)),
    dro = sum(ro, x => x.dist) / (ro.length || 1),
    dsl = (() => {
      const x = ords.map(o => route(o, 'lista', C.nw));
      return sum(x, y => y.dist) / (x.length || 1);
    })(),
    dl =
      sum(
        ords.map(o => route(o, 'lista', C.cur)),
        x => x.dist
      ) / (ords.length || 1);
  const sh = k => {
      const c = DB.cau.find(c => norm(c.causa).includes(k));
      return c ? num(c.frecuencia) / C.cauT : 0;
    },
    inc = C.incAvg,
    red =
      (inc *
        (sh('ubicacion') * AJ.rUb + sh('diferencia') * AJ.rEri + sh('faltadeprod') * AJ.rRop)) /
      100,
    op = C.otifAvg - C.sl * red * -1 * -1,
    otp = C.otifAvg + -C.sl * red;
  const v = (x, y) => (x ? (y / x - 1) * 100 : 0),
    pv = (x, y) => `<span class="tag ${y < x ? 't-g' : 't-b'}">${fmt(v(x, y), 1)} %</span>`,
    hs = ((a.t - b.t) * C.nped) / (AJ.vent / 30) / 3600;
  const sd = TAB.sd || 0,
    sl = TAB.sl || 0,
    sv = TAB.sv || AJ.z,
    Rs = C.rep(ZV[sv] || 1.645, sd / 100, sl),
    rz = Rs.filter(s => s.st == 'PEDIR').length,
    incF = inc * sh('faltadeprod'),
    otS = otp - C.sl * 0 + -C.sl * (incF * (1 - AJ.rRop / 100)) * (rz / (C.pedir.length || 1) - 1);
  return (
    head(
      'Escenarios',
      'Compare la situación actual con la propuesta y pruebe «qué pasa si» cambia la demanda o el tiempo de entrega.',
      `<button class="btn" id="brec">↻ Recalcular simulación</button>`
    ) +
    `<div class="card"><h2>Situación actual (As-Is) frente a la propuesta (To-Be)</h2>${tbl(
      ['Indicador', 'Actual', 'Propuesta', 'Variación', 'Origen', 'Módulo'],
      [
        [
          'Distancia media por pedido',
          fmt(a.d) + ' m',
          fmt(b.d) + ' m',
          pv(a.d, b.d),
          'Simulado',
          '1 + 2'
        ],
        ['Tiempo de armado por pedido', mmss(a.t), mmss(b.t), pv(a.t, b.t), 'Simulado', '1 + 2'],
        ['Exposición media al frío', mmss(a.c), mmss(b.c), pv(a.c || 1, b.c), 'Simulado', '2'],
        [
          'Pedidos que exceden ' + AJ.frioMax + ' min en frío',
          pc(a.ex),
          pc(b.ex),
          '',
          'Simulado',
          '2'
        ],
        ['SKUs con riesgo térmico', C.termico, 0, '', 'Simulado', '1'],
        ['ERI por SKU', pc(C.eri), AJ.eri + ' %', '', 'Objetivo (Ajustes)', '3'],
        [
          'OTIF (promedio mensual)',
          fmt(C.otifAvg, 1) + ' %',
          fmt(otp, 1) + ' %',
          '+' + fmt(otp - C.otifAvg, 1) + ' pp',
          'Proyección',
          '1 + 2 + 3'
        ],
        [
          'Incidencias de almacén por mes',
          fmt(inc),
          fmt(inc - red),
          pv(inc || 1, inc - red),
          'Proyección',
          '1 + 2 + 3'
        ],
        [
          'Horas de picking ahorradas por mes',
          '—',
          fmt(hs, 0) + ' h',
          '',
          'Simulado × volumen',
          '1 + 2'
        ],
        [
          'Ahorro mensual en mano de obra',
          '—',
          sol(hs * AJ.costoH),
          '',
          '× costo hora (Ajustes)',
          '1 + 2'
        ]
      ]
    )}<p class="mu">Simulación con ${ords.length} pedidos reales de sus datos.</p></div>
<div class="card"><h2>¿Qué aporta cada módulo? (distancia media por pedido)</h2>${bars([
      ['Situación actual', a.d, '#94a3b8', fmt(a.d) + ' m'],
      [
        'Solo ruteo óptimo',
        Math.min(
          a.d,
          sum(
            ords.map(o => route(o, 'zonas', C.cur)),
            x => x.dist
          ) / (ords.length || 1)
        ),
        '#0284c7',
        fmt(a.d) + ' m (ruteo ya incluido en As-Is)'
      ],
      ['Solo reubicación (lista impresa)', dsl, '#d97706', fmt(dsl) + ' m'],
      ['Reubicación + ruteo', b.d, '#16a34a', fmt(b.d) + ' m (' + fmt(v(a.d, b.d), 1) + ' %)']
    ])}<p class="mu">Referencia: lista impresa con ubicaciones actuales = ${fmt(dl)} m; vecino más cercano = ${fmt(dro)} m.</p></div>
<div class="card"><h2>Proyección del OTIF</h2><div class="grid">${kpi('OTIF actual', fmt(C.otifAvg, 1) + ' %', 'Meta ' + AJ.meta + ' %', 'wa')}${kpi('OTIF proyectado con el artefacto', fmt(otp, 1) + ' %', '+' + fmt(otp - C.otifAvg, 1) + ' puntos', 'wa')}${kpi('Incidencias por mes', fmt(inc) + ' → ' + fmt(inc - red), 'según la efectividad supuesta')}</div><p class="mu">OTIF proyectado = OTIF actual + pendiente (${fmt(C.sl, 3)} pp por incidencia) × cambio de incidencias. La reducción por módulo es un supuesto (Ajustes).</p></div>
<div class="card"><h2>Simulador «¿Qué pasa si…?»</h2><div class="grid"><label>Variación de la demanda: <b>${sd > 0 ? '+' : ''}${sd} %</b><br><input type="range" id="sd" min="-30" max="50" value="${sd}" style="width:100%"></label><label>Retraso en el lead time: <b>+${sl} d</b><br><input type="range" id="sl" min="0" max="10" value="${sl}" style="width:100%"></label><label>Nivel de servicio<br><select id="sv">${[90, 95, 97, 99].map(z => `<option ${z == sv ? 'selected' : ''}>${z}</option>`).join('')}</select></label></div><div class="grid">${kpi('SKUs en riesgo de quiebre', rz, `Hoy: ${C.pedir.length} (${rz - C.pedir.length >= 0 ? '+' : ''}${rz - C.pedir.length})`, rz > C.pedir.length ? 'er' : 'ok')}${kpi('Stock de seguridad total', fmt(sum(Rs, s => s.ss)) + ' u.', 'Hoy: ' + fmt(sum(C.R, s => s.ss)) + ' u.')}${kpi(
      'Inversión inmediata en reposición',
      sol(
        sum(
          Rs.filter(s => s.st == 'PEDIR'),
          s => s.inv
        )
      ),
      'para los SKUs bajo su punto de reorden'
    )}${kpi('OTIF proyectado', fmt(otS, 1) + ' %', otS < AJ.meta ? 'Bajo la meta de ' + AJ.meta + ' %' : 'Cumple la meta', 'wa')}</div></div>`
  );
};
V.aju = () =>
  head(
    'Ajustes',
    'Parámetros y supuestos del modelo. Cambiar un valor recalcula todo el sistema.',
    `<button class="btn p" id="bsave">✓ Guardar cambios</button><button class="btn" id="brst">↺ Restablecer valores</button>`
  ) +
  `<div class="grid g2">${AJD.map(([t, f]) => `<div class="card"><h2>${t}</h2>${f.map(([k, l, ty]) => `<div class="fld"><span>${l}</span>${ty ? `<select data-a="${k}">${[90, 95, 97, 99].map(z => `<option ${AJ[k] == z ? 'selected' : ''}>${z}</option>`).join('')}</select>` : `<input type="number" step="any" data-a="${k}" value="${AJ[k]}">`}</div>`).join('')}</div>`).join('')}</div><div class="card"><h2>Acerca de</h2><p>AXIONLOG web · versión 1.0. Los datos se guardan en este navegador (almacenamiento local).</p></div>`;

// ===== Navegación y eventos =====
let CUR = 'panel';
function go(v, t) {
  CUR = v;
  if (t) TAB.i = +t;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.go == v));
  $('#banner').style.display = DB.demo ? 'flex' : 'none';
  $('#view').innerHTML = V[v]();
  bind();
  scrollTo(0, 0);
}
const refresh = () => {
  const y = scrollY;
  $('#banner').style.display = DB.demo ? 'flex' : 'none';
  $('#view').innerHTML = V[CUR]();
  bind();
  scrollTo(0, y);
};
function bind() {
  const on = (s, f) => $$(s).forEach(e => (e.onclick = () => f(e)));
  on('[data-go]', e => go(e.dataset.go, e.dataset.tab));
  on('[data-t]', e => {
    TAB.u = +e.dataset.t[1];
    refresh();
  });
  on('[data-o]', e => {
    TAB.o = +e.dataset.o;
    refresh();
  });
  on('[data-p]', e => {
    TAB.pp = +e.dataset.p;
    refresh();
  });
  on('[data-i]', e => {
    TAB.i = +e.dataset.i;
    refresh();
  });
  const ch = (s, f) => {
    const e = $(s);
    if (e) e.onchange = () => f(e.value);
  };
  ch('#po', v => {
    TAB.po = v;
    refresh();
  });
  ch('#pm', v => {
    TAB.pm = v;
    refresh();
  });
  ch('#sd', v => {
    TAB.sd = +v;
    refresh();
  });
  ch('#sl', v => {
    TAB.sl = +v;
    refresh();
  });
  ch('#sv', v => {
    TAB.sv = +v;
    refresh();
  });
  const uf = $('#uf');
  if (uf)
    uf.oninput = () => {
      TAB.uf = uf.value;
      const p = uf.selectionStart;
      refresh();
      const n = $('#uf');
      n.focus();
      n.setSelectionRange(p, p);
    };
  const b = (s, f) => {
    const e = $(s);
    if (e) e.onclick = f;
  };
  b('#bdemo', () => {
    seed = 11;
    Object.assign(DB, demo());
    save();
    calc();
    refresh();
    $('#msg').textContent = 'Datos de ejemplo cargados';
  });
  b('#brec', () => {
    seed = 11;
    refresh();
  });
  b('#bclr', () => {
    if (confirm('¿Borrar todos los datos de este navegador?')) {
      DB = { inv: [], ped: [], otif: [], cau: [], demo: 0 };
      LAY = defLayout();
      graph();
      save();
      calc();
      refresh();
    }
  });
  b('#bexp', () => {
    if (CUR == 'datos') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify({ DB, AJ, lay: LAY })], { type: 'application/json' })
      );
      a.download = 'axionlog_copia.json';
      a.click();
    } else if (CUR == 'ubic')
      csvOut('plan_traslados', [
        ['Prioridad', 'SKU', 'Producto', 'Rack actual', 'Rack propuesto', 'Mejora m'],
        ...C.mov.map(m => [m.pr, m.sku, m.desc, m.rack, m.pn, Math.round(m.mej)])
      ]);
    else if (CUR == 'pick') {
      const o = C.ords.find(x => x.id == (TAB.po || C.ords[0].id)),
        r = route(o, TAB.pm || 'zonas', TAB.pp ? C.nw : C.cur);
      csvOut('hoja_picking_' + o.id, [
        ['Paso', 'Rack', 'Zona', 'SKU', 'Producto', 'Cantidad'],
        ...r.hoja
      ]);
    } else if (CUR == 'inv')
      csvOut('inventario_compras', [
        ['SKU', 'Producto', 'Decisión', 'Stock', 'Punto reorden', 'Cantidad a pedir', 'Inversión'],
        ...C.R.filter(s => s.st != 'OK').map(s => [
          s.sku,
          s.desc,
          s.st,
          s.sys,
          Math.round(s.rop),
          s.q,
          Math.round(s.inv)
        ])
      ]);
  });
  b('#bpaste', () => $('#dlg').showModal());
  const fi = $('#fi');
  if (fi)
    fi.onchange = async () => {
      let m = [];
      for (const f of fi.files) m.push(ingest(await f.text(), f.name));
      refresh();
      $('#msg').textContent = m.join(' · ');
    };
  b('#bsave', () => {
    $$('[data-a]').forEach(e => (AJ[e.dataset.a] = +e.value));
    save();
    calc();
    refresh();
  });
  b('#brst', () => {
    AJ = { ...AJ0 };
    save();
    calc();
    refresh();
  });
}
$('#nav').innerHTML = MENU.map(m =>
  m[0] == 'h'
    ? `<h6>${m[1]}</h6>`
    : `<a data-go="${m[0]}" title="${m[1]}"><i style="background:${m[3]}">${m[2]}</i><span>${m[1]}</span></a>`
).join('');
$('#hide').onclick = () => {
  const m = $('#side').classList.toggle('mini');
  $('#hi').textContent = m ? '»' : '«';
};
$('#cx').onclick = () => $('#dlg').close();
$('#ok').onclick = async () => {
  let t = $('#ta').value.trim();
  if (!t) return;
  if (/^https?:/.test(t)) {
    const m = t.match(/\/d\/([\w-]+)/),
      g = t.match(/gid=(\d+)/);
    if (!m) {
      $('#dm').textContent = 'Link no válido';
      return;
    }
    if (!g) {
      const out = [];
      $('#dm').textContent = 'Leyendo hojas…';
      for (const n of ['Inventario', 'Pedidos', 'OTIF', 'Causas']) {
        try {
          const x = await (
            await fetch(
              `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv&sheet=${n}`
            )
          ).text();
          out.push(x.trim()[0] == '<' ? n + ': no existe' : ingest(x));
        } catch (e) {
          out.push(n + ': no se pudo leer');
        }
      }
      $('#dm').textContent = out.join(' · ');
      if (out.some(o => o.startsWith('Cargado'))) {
        refresh();
      }
      return;
    }
    try {
      t = await (
        await fetch(
          `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${g ? '&gid=' + g[1] : ''}`
        )
      ).text();
    } catch (e) {
      $('#dm').textContent = 'No se pudo leer el link: revise que esté compartido o suba el CSV.';
      return;
    }
  }
  const r = ingest(t);
  $('#dm').textContent = r;
  if (r.startsWith('Cargado')) {
    $('#dlg').close();
    $('#ta').value = '';
    refresh();
  }
};
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', async e => {
  e.preventDefault();
  let m = [];
  for (const f of e.dataTransfer.files) m.push(ingest(await f.text(), f.name));
  go('datos');
  $('#msg').textContent = m.join(' · ');
});
graph();
if (!DB.inv.length) {
  seed = 11;
  Object.assign(DB, demo());
}
calc();
go('panel');
