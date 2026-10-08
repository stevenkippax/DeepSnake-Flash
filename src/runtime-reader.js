/* Read-only introspection of the shipped Unity 2021.3 / IL2CPP v29 client.
   No score, physics, game-object, or network mutations. */
(() => {
  const M = unityInstance.Module, U = M.HEAPU8, W = M.HEAPU32;
  const reader = {
    u(p) { return M.HEAPU32[p >>> 2]; },
    f(p) { return M.HEAPF32[p >>> 2]; },
    str(p) {
      if (p < 1 || p >= M.HEAPU8.length) return '';
      let s = ''; for (let i = p; i < p + 150 && M.HEAPU8[i]; i++) s += String.fromCharCode(M.HEAPU8[i]);
      return s;
    },
    type(p) { const c = this.u(p); return { c, name: this.str(this.u(c + 8)), ns: this.str(this.u(c + 12)) }; },
    fields(c) {
      const a = [], base = this.u(c + 64), count = M.HEAPU16[(c + 168) >>> 1];
      if (!base) return a;
      for (let i = 0; i < Math.min(count, 200); i++) {
        const p = base + i * 20;
        a.push({ name: this.str(this.u(p)), type: this.u(p + 4), offset: this.u(p + 12) });
      }
      return a;
    },
    allFields(c) {
      const a = [], seen = new Set();
      while (c && !seen.has(c)) { seen.add(c); a.push(...this.fields(c)); c = this.u(c + 44); }
      return a;
    },
    object(p) {
      const t = this.type(p);
      return { p, ...t, fields: this.allFields(t.c).map(a => ({ ...a, u: this.u(p + a.offset), f: this.f(p + a.offset) })) };
    }
  };
  const names = [{"name": "CoreGameController", "ns": "", "offset": 831545}, {"name": "PelletRenderer", "ns": "SnakeIO", "offset": 1027829}, {"name": "CameraController", "ns": "SnakeIO.Multiplayer", "offset": 1073072}, {"name": "PlayerController", "ns": "SnakeIO.Multiplayer", "offset": 1091305}, {"name": "WallRenderer", "ns": "SnakeIO.Multiplayer", "offset": 1098281}, {"name": "InputManager", "ns": "UnityEngine.InputSystem", "offset": 948639}, {"name": "Application", "ns": "UnityEngine", "offset": 1320090}];
  const bases = [];
  for (let i = 0; i < W.length - 2; i++) if (W[i] === 0xFAB11BAF && W[i + 1] === 29) bases.push(i * 4);
  const candidates = new Map();
  for (const base of bases) for (const name of names) candidates.set(base + name.offset, name);
  const classes = [];
  for (let i = 2; i < W.length - 48; i++) {
    const name = candidates.get(W[i]); if (!name) continue;
    const p = (i - 2) * 4;
    if (W[i + 13] === p && reader.str(W[i + 1]) === name.ns) classes.push({ p, name: name.name, ns: name.ns });
  }
  const coreClass = classes.find(x => x.name === 'CoreGameController' && x.ns === '');
  if (!coreClass) throw Error('Current client type metadata was not found');
  const core = reader.u(reader.u(coreClass.p + 92)), registry = reader.u(core + 96);
  if (reader.type(registry).name !== 'Players') throw Error('Current player registry was not found');
  const pelletClass = classes.find(x => x.name === 'PelletRenderer' && x.ns === 'SnakeIO');
  function refreshRenderers() {
  const renderers = [];
  const W = M.HEAPU32;
  for (let i = 0; i < W.length; i++) {
    if (W[i] !== pelletClass.p || W[i + 1] !== 0 || W[i + 2] < 1000000) continue;
    const p = i * 4, dict = reader.u(p + 44);
    if (reader.type(dict).name === 'Dictionary`2') renderers.push({ p });
  }
  window.__snakePelletRenderers = renderers;
  return renderers;
  }
  reader.refreshRenderers = refreshRenderers;
  const renderers = refreshRenderers();
  window.__snakeReader = reader;
  const wallClass=classes.find(c=>c.name==='WallRenderer'&&c.ns==='SnakeIO.Multiplayer');
  function refreshArena() {
    let arena=null;const W=M.HEAPU32;
    if(wallClass)for(let i=0;i<W.length-16;i++)if(W[i]===wallClass.p&&W[i+1]===0) {
      const p=i*4,width=reader.f(p+12),height=reader.f(p+16),wallWidth=reader.f(p+20);
      if(width>80&&width<120&&height>80&&height<120&&wallWidth>1&&wallWidth<5)arena={width,height,wallWidth,inner:Math.min(width,height)/2-wallWidth/2};
    }
    return arena;
  }
  reader.refreshArena=refreshArena;
  const arena=refreshArena();
  window.__snakeRuntime = { core, registry, classes, metadataBases: bases, version: 29,arena,
    arenaLimit:arena?Math.floor(arena.inner):46,arenaInnerEdge:arena?.inner??48.55 };
  window.__snakePelletRenderers = renderers;
  return { registry, core, classes: classes.length, renderers: renderers.length };
})();
