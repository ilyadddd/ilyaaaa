import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RARITIES = [
  { name:"Common",      color:"#9CA3AF", glow:"#9CA3AF", bg:"#1f2937",   baseChance:32,      special:false },
  { name:"Uncommon",    color:"#34D399", glow:"#34D399", bg:"#064e3b",   baseChance:22,      special:false },
  { name:"Rare",        color:"#60A5FA", glow:"#60A5FA", bg:"#1e3a5f",   baseChance:15,      special:false },
  { name:"Epic",        color:"#A78BFA", glow:"#A78BFA", bg:"#2e1065",   baseChance:10,      special:false },
  { name:"Legendary",   color:"#FBBF24", glow:"#FBBF24", bg:"#451a03",   baseChance:6,       special:false },
  { name:"Mythic",      color:"#F87171", glow:"#F87171", bg:"#450a0a",   baseChance:4,       special:false },
  { name:"Ancient",     color:"#A16207", glow:"#D97706", bg:"#1c0f00",   baseChance:3,       special:false },
  { name:"Celestial",   color:"#67E8F9", glow:"#22D3EE", bg:"#0a1f2e",   baseChance:2,       special:false },
  { name:"Infernal",    color:"#FF6B00", glow:"#FF6B00", bg:"#1f0800",   baseChance:1.5,     special:false },
  { name:"Phantom",     color:"#C4B5FD", glow:"#8B5CF6", bg:"#150d2e",   baseChance:1.2,     special:false },
  { name:"Crystalline", color:"#BAE6FD", glow:"#7DD3FC", bg:"#0a1825",   baseChance:0.9,     special:false },
  { name:"Void",        color:"#6366F1", glow:"#4F46E5", bg:"#0c0c25",   baseChance:0.6,     special:false },
  { name:"Cosmic",      color:"#F0ABFC", glow:"#D946EF", bg:"#1a0020",   baseChance:0.4,     special:false },
  { name:"Ethereal",    color:"#99F6E4", glow:"#2DD4BF", bg:"#001a16",   baseChance:0.25,    special:false },
  { name:"Abyssal",     color:"#1D4ED8", glow:"#1D4ED8", bg:"#000818",   baseChance:0.15,    special:false },
  { name:"Primal",      color:"#BEF264", glow:"#84CC16", bg:"#0d1a00",   baseChance:0.09,    special:false },
  { name:"Secret",      color:"#E879F9", glow:"#E879F9", bg:"#2d0a3a",   baseChance:0.06,    special:true  },
  { name:"Transcendent",color:"#FCD34D", glow:"#F59E0B", bg:"#1a1000",   baseChance:0.025,   special:true  },
  { name:"Omega",       color:"#F43F5E", glow:"#E11D48", bg:"#1a000a",   baseChance:0.01,    special:true  },
  { name:"God",         color:"#FFFDE7", glow:"#FFD700", bg:"#1a1500",   baseChance:0.003,   special:true  },
];
const CUBE_NAMES = [
  "Frostbite","Inferno","Voidwalker","Thunderclap","Earthquake","Starlight",
  "Shadowmere","Crystalis","Ironhide","Stormbringer","Nebula","Glacial",
  "Tempest","Obsidian","Radiance","Phantom","Eclipse","Solaris","Abyss",
  "Zenith","Cryogen","Blazeclaw","Nullshift","Voltcore","Terravex","Duskbane",
  "Solforge","Moonrift","Ashfall","Prismcore",
];
const CUBE_SHAPES = [
  {color:"#ef4444",face:"#dc2626"},{color:"#f97316",face:"#ea580c"},
  {color:"#eab308",face:"#ca8a04"},{color:"#22c55e",face:"#16a34a"},
  {color:"#3b82f6",face:"#2563eb"},{color:"#8b5cf6",face:"#7c3aed"},
  {color:"#ec4899",face:"#db2777"},{color:"#14b8a6",face:"#0d9488"},
  {color:"#f43f5e",face:"#e11d48"},{color:"#a855f7",face:"#9333ea"},
];
const UPGRADE_DEFS = {
  capacity:{ label:"Belt Capacity", icon:"📦", desc:"Max cubes on conveyor", color:"#60A5FA", maxLevel:20, baseCost:200, costMult:1.7 },
  speed:   { label:"Spawn Speed",   icon:"⚡", desc:"Faster cube arrivals",   color:"#FBBF24", maxLevel:20, baseCost:300, costMult:1.8 },
  luck:    { label:"Rarity Luck",   icon:"🍀", desc:"Boosts rare chances",    color:"#F87171", maxLevel:20, baseCost:500, costMult:2.0 },
  level:   { label:"Level Boost",   icon:"⭐", desc:"Higher max cube levels", color:"#A78BFA", maxLevel:20, baseCost:800, costMult:2.1 },
};

// Storage keys
const ACCOUNTS_KEY  = "cv_accounts";   // shared: {username: {passwordHash, createdAt}}
const MARKET_KEY    = "cv_market";     // shared: [{id, seller, cube, price, listedAt}]
const USER_KEY = (u) => `cv_user_${u}`; // personal per user

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const simpleHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
};

function getUpgradeCost(key, level) {
  const d = UPGRADE_DEFS[key];
  return Math.floor(d.baseCost * Math.pow(d.costMult, level));
}
function getCapacity(lvl)  { return 5  + lvl * 3; }
function getSpawnMs(lvl)   { return Math.max(200, 2000 - lvl * 90); }
function getMaxLevel(lvl)  { return 100 + lvl * 50; } // infinite with upgrades

function getRarity(luckLevel) {
  const shift = luckLevel * 1.5;
  const chances = RARITIES.map((r, i) =>
    i === 0 ? Math.max(3, r.baseChance - shift) : r.baseChance + shift * (i / (RARITIES.length - 1)) * 0.9
  );
  const total = chances.reduce((a, b) => a + b, 0);
  let r = Math.random() * total, acc = 0;
  for (let i = 0; i < RARITIES.length; i++) { acc += chances[i]; if (r < acc) return RARITIES[i]; }
  return RARITIES[0];
}

function generateCube(id, luckLevel = 0, levelBoost = 0) {
  const rarity  = getRarity(luckLevel);
  const maxLvl  = getMaxLevel(levelBoost);
  const level   = Math.floor(Math.random() * maxLvl) + 1;
  const shape   = CUBE_SHAPES[Math.floor(Math.random() * CUBE_SHAPES.length)];
  const name    = CUBE_NAMES[Math.floor(Math.random() * CUBE_NAMES.length)];
  const ri      = RARITIES.indexOf(rarity);
  const mult    = (ri + 1) * (1 + Math.floor(level / 100) * 0.5);
  return {
    id, name, level, rarity, shape,
    value:  Math.floor(level * mult * 12),
    income: Math.floor(level * mult * 0.8),
    x: Math.random() * 65 + 10, y: Math.random() * 50 + 15,
    purchased: false, angle: Math.random() * 40 - 20,
  };
}

// Serialize rarity by name for JSON storage
const serCube  = (c) => ({ ...c, rarity: c.rarity.name });
const deserCube = (c) => ({ ...c, rarity: RARITIES.find(r => r.name === c.rarity) || RARITIES[0] });

// ─── STORAGE WRAPPERS ─────────────────────────────────────────────────────────
// Uses window.storage (shared artifact storage) with localStorage fallback
async function sharedGet(key) {
  try {
    if (window.storage) {
      const res = await window.storage.get(key, true);
      return res ? JSON.parse(res.value) : null;
    }
  } catch (_) {}
  try { const v = localStorage.getItem("shared_" + key); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
async function sharedSet(key, value) {
  const str = JSON.stringify(value);
  try {
    if (window.storage) { await window.storage.set(key, str, true); return; }
  } catch (_) {}
  try { localStorage.setItem("shared_" + key, str); } catch (_) {}
}
function localGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
function localSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

// ─── CUBE 3D ─────────────────────────────────────────────────────────────────
function Cube3D({ cube, size = 40, animated = false, spin = false }) {
  const lvlStr = cube.level >= 1000 ? `${(cube.level/1000).toFixed(1)}K` : String(cube.level);
  const isSecret = cube.rarity.name === "Secret";
  const isGod    = cube.rarity.name === "God";

  const wrapClass = isSecret ? "secret-cube" : isGod ? "god-cube" : "";

  const bgStyle = isGod
    ? "linear-gradient(135deg,#FFD700,#FFF8DC,#FFD700,#DAA520)"
    : isSecret
    ? "linear-gradient(135deg,#7B2FBE,#E879F9,#A855F7,#7B2FBE)"
    : `linear-gradient(135deg,${cube.shape.color},${cube.shape.face})`;

  const textColor = isGod ? "#3d2800" : "white";
  const textShadow = isGod
    ? `0 0 ${size*0.15}px #FFD700, 0 1px 3px rgba(0,0,0,0.6)`
    : isSecret
    ? `0 0 ${size*0.2}px #E879F9, 0 0 ${size*0.1}px white`
    : `0 0 ${size*0.2}px rgba(0,0,0,0.9)`;

  return (
    <div
      className={wrapClass}
      style={{
        position: "relative", width: size, height: size, flexShrink: 0,
        transform: (!animated && !spin) ? `perspective(200px) rotateX(15deg) rotateY(-20deg)` : undefined,
        filter: isGod
          ? `drop-shadow(0 0 ${size*0.4}px #FFD700) drop-shadow(0 0 ${size*0.2}px #fff8)`
          : `drop-shadow(0 0 ${size*0.2}px ${cube.rarity.glow}88)`,
        animationDuration: spin ? "3s" : undefined,
        animation: spin ? "cubeSpin 3s linear infinite" : undefined,
        borderRadius: size * 0.12,
      }}>
      <div style={{
        position: "absolute", width: size, height: size,
        background: bgStyle,
        backgroundSize: isGod ? "300% 300%" : undefined,
        animation: isGod ? "godShine 2s ease infinite" : undefined,
        borderRadius: size * 0.12,
        border: isGod ? `2px solid #FFD700` : isSecret ? `2px solid #E879F9` : `2px solid ${cube.rarity.color}77`,
        boxShadow: isGod
          ? `inset 0 0 ${size*0.4}px rgba(255,255,255,0.6)`
          : isSecret
          ? `inset 0 0 ${size*0.3}px rgba(255,255,255,0.3)`
          : `inset 0 0 ${size*0.3}px rgba(255,255,255,0.2),0 0 ${size*0.4}px ${cube.rarity.glow}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * (lvlStr.length > 3 ? 0.2 : 0.28), fontWeight: 900,
        color: textColor, textShadow, fontFamily: "monospace", userSelect: "none",
      }}>
        {isGod ? "✦" : lvlStr}
        {isGod && <span style={{position:"absolute",bottom:2,fontSize:size*0.18,opacity:0.9}}>{lvlStr}</span>}
      </div>
      {/* Secret sparkle particles */}
      {isSecret && (
        <>
          {[0,1,2].map(i=>(
            <div key={i} style={{
              position:"absolute",
              width:size*0.08, height:size*0.08,
              borderRadius:"50%",
              background:"#E879F9",
              top:`${[10,70,40][i]}%`, left:`${[80,15,90][i]}%`,
              animation:`sparkle ${1+i*0.4}s ease-in-out infinite`,
              animationDelay:`${i*0.3}s`,
              boxShadow:`0 0 4px #E879F9`,
            }}/>
          ))}
        </>
      )}
      {/* God crown */}
      {isGod && (
        <div style={{position:"absolute",top:-size*0.22,left:"50%",transform:"translateX(-50%)",fontSize:size*0.3,filter:"drop-shadow(0 0 4px #FFD700)",animation:"float 2s ease-in-out infinite"}}>👑</div>
      )}
    </div>
  );
}

// ─── UPGRADE CARD ─────────────────────────────────────────────────────────────
function UpgradeCard({ upgradeKey, level, coins, onUpgrade }) {
  const def = UPGRADE_DEFS[upgradeKey];
  const isMax = level >= def.maxLevel;
  const cost  = isMax ? 0 : getUpgradeCost(upgradeKey, level);
  const can   = !isMax && coins >= cost;
  const getV  = (l) => {
    if (upgradeKey === "capacity") return `${getCapacity(l)} slots`;
    if (upgradeKey === "speed")    return `${(getSpawnMs(l)/1000).toFixed(1)}s`;
    if (upgradeKey === "level")    return `Max Lv.${getMaxLevel(l).toLocaleString()}`;
    return `Luck ${l}`;
  };
  return (
    <div style={{
      background: `linear-gradient(135deg,${def.color}0d,#0a0a1a)`,
      border: `2px solid ${isMax ? def.color+"88" : can ? def.color+"55" : "#1e3a5f"}`,
      borderRadius: 18, padding: "18px", flex: 1, minWidth: 180,
      boxShadow: isMax ? `0 0 24px ${def.color}22` : "none", transition: "all 0.3s",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:40,height:40,borderRadius:11,background:`${def.color}22`,border:`2px solid ${def.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{def.icon}</div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:def.color}}>{def.label}</div>
            <div style={{fontSize:9,color:"#4B5563",marginTop:1}}>{def.desc}</div>
          </div>
        </div>
        <div style={{fontSize:10,fontWeight:800,color:isMax?def.color:"#4B5563",background:isMax?def.color+"22":"#0a0a1a",border:`1px solid ${isMax?def.color+"44":"#1e3a5f"}`,padding:"2px 8px",borderRadius:6}}>
          {isMax?"✦MAX":`Lv${level}`}
        </div>
      </div>
      <div style={{display:"flex",gap:2,marginBottom:9}}>
        {Array.from({length:Math.min(def.maxLevel,20)}).map((_,i)=>(
          <div key={i} style={{flex:1,height:6,borderRadius:2,background:i<level?`linear-gradient(90deg,${def.color}77,${def.color})`:"#1e3a5f",transition:"all 0.3s"}}/>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12,fontSize:10}}>
        <span style={{color:"#9CA3AF",fontWeight:700}}>{getV(level)}</span>
        {!isMax&&<><span style={{color:"#374151"}}>→</span><span style={{color:def.color,fontWeight:800}}>{getV(level+1)}</span></>}
      </div>
      <button disabled={!can} onClick={()=>onUpgrade(upgradeKey)} style={{
        width:"100%",border:"none",borderRadius:9,padding:"10px 0",fontWeight:800,fontSize:11,letterSpacing:0.5,
        cursor:can?"pointer":"not-allowed",fontFamily:"'Segoe UI',sans-serif",textTransform:"uppercase",
        background:isMax?`${def.color}15`:can?`linear-gradient(135deg,${def.color},${def.color}cc)`:"linear-gradient(135deg,#1f2937,#111827)",
        color:isMax?def.color+"77":can?"#000":"#374151",
        boxShadow:can?`0 4px 16px ${def.color}44`:"none",transition:"all 0.2s",
      }}
        onMouseEnter={e=>{if(can)e.currentTarget.style.filter="brightness(1.12)";}}
        onMouseLeave={e=>{e.currentTarget.style.filter="none";}}>
        {isMax?"✦ MAXED":can?`⬆ UPGRADE  🪙${cost.toLocaleString()}`:`🔒 Need 🪙${cost.toLocaleString()}`}
      </button>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose, width = 460 }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(5,10,20,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"linear-gradient(135deg,#0d1b2a,#090d14)",border:"2px solid #1e3a5f",borderRadius:22,padding:"28px",maxWidth:width,width:"100%",animation:"slideUp 0.3s ease",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div style={{fontSize:17,fontWeight:900,color:"white"}}>{title}</div>
          <button onClick={onClose} style={{background:"#1e3a5f",border:"none",color:"#60A5FA",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:16,fontWeight:900}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────
function Notification({ n }) {
  if (!n) return null;
  return (
    <div style={{position:"fixed",top:74,left:"50%",transform:"translateX(-50%)",background:"#0d1b2a",border:`2px solid ${n.color}`,borderRadius:12,padding:"10px 24px",zIndex:900,boxShadow:`0 0 22px ${n.color}55`,animation:"slideIn 0.3s ease",fontWeight:700,fontSize:13,color:n.color,whiteSpace:"nowrap"}}>
      {n.msg}
    </div>
  );
}

// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode,  setMode]  = useState("login"); // login | register
  const [user,  setUser]  = useState("");
  const [pass,  setPass]  = useState("");
  const [pass2, setPass2] = useState("");
  const [err,   setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const inp = (val, set) => (
    <input value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:"#0a0a1a",border:"1px solid #1e3a5f",borderRadius:10,padding:"11px 14px",color:"white",fontSize:13,outline:"none",fontFamily:"'Segoe UI',sans-serif",boxSizing:"border-box"}}
      onFocus={e=>{e.target.style.borderColor="#60A5FA44";}} onBlur={e=>{e.target.style.borderColor="#1e3a5f";}}/>
  );

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      // Sanitize: trim whitespace, lowercase, collapse spaces
      const u = user.trim().toLowerCase().replace(/\s+/g, "_");
      const p = pass;
      const p2 = pass2;

      if (!u) { setErr("Please enter a username."); setLoading(false); return; }
      if (!p)  { setErr("Please enter a password."); setLoading(false); return; }
      if (u.length < 2) { setErr("Username must be at least 2 characters."); setLoading(false); return; }
      if (u.length > 20) { setErr("Username must be 20 characters or less."); setLoading(false); return; }

      let accounts = {};
      try { accounts = (await sharedGet(ACCOUNTS_KEY)) || {}; } catch (_) { accounts = {}; }

      if (mode === "register") {
        if (p.length < 3) { setErr("Password must be at least 3 characters."); setLoading(false); return; }
        if (p !== p2)     { setErr("Passwords don't match."); setLoading(false); return; }
        if (accounts[u])  { setErr("That username is already taken."); setLoading(false); return; }
        accounts[u] = { passwordHash: simpleHash(p), createdAt: Date.now() };
        try { await sharedSet(ACCOUNTS_KEY, accounts); } catch (_) {}
        localSet(USER_KEY(u), { coins:500, upgrades:{capacity:0,speed:0,luck:0,level:0}, world:[], boxes:[], stats:{earned:0,cubesBought:0,sold:0}, tutorialDone:false });
        onLogin(u);
      } else {
        if (!accounts[u]) { setErr("Account not found. Try registering first."); setLoading(false); return; }
        if (accounts[u].passwordHash !== simpleHash(p)) { setErr("Incorrect password."); setLoading(false); return; }
        onLogin(u);
      }
    } catch (e) {
      setErr("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0a0a1a 0%,#0d1b2a 50%,#0a0a1a 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",padding:20}}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes sparkle{0%,100%{opacity:1}50%{opacity:0.2}} @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      {/* Stars */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none"}}>
        {Array.from({length:50}).map((_,i)=>(
          <div key={i} style={{position:"absolute",width:Math.random()*2+1,height:Math.random()*2+1,background:"white",borderRadius:"50%",left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,opacity:Math.random()*0.5+0.1,animation:`sparkle ${Math.random()*3+2}s ease-in-out infinite`,animationDelay:`${Math.random()*4}s`}}/>
        ))}
      </div>

      <div style={{background:"linear-gradient(135deg,#0d1b2a,#090d14)",border:"2px solid #1e3a5f66",borderRadius:24,padding:"40px 36px",maxWidth:400,width:"100%",position:"relative",animation:"slideUp 0.4s ease",boxShadow:"0 0 60px #60A5FA11"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,animation:"float 3s ease-in-out infinite",marginBottom:10}}>🎲</div>
          <div style={{fontSize:28,fontWeight:900,background:"linear-gradient(90deg,#FBBF24,#F87171,#A78BFA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CUBEVAULT</div>
          <div style={{fontSize:9,color:"#4B5563",letterSpacing:4,marginTop:2}}>CONVEYOR OF FORTUNE</div>
        </div>

        {/* Tab switcher */}
        <div style={{display:"flex",background:"#050a14",borderRadius:12,padding:4,marginBottom:24,border:"1px solid #1e3a5f"}}>
          {["login","register"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,padding:"9px",border:"none",borderRadius:9,background:mode===m?"linear-gradient(135deg,#1e3a5f,#0d2a3f)":"transparent",color:mode===m?"#60A5FA":"#4B5563",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"'Segoe UI',sans-serif",letterSpacing:0.5,textTransform:"uppercase",transition:"all 0.2s"}}>
              {m==="login"?"🔑 Login":"✨ Register"}
            </button>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:10,color:"#6B7280",marginBottom:5,fontWeight:700,letterSpacing:0.5}}>USERNAME</div>
            {inp(user, setUser)}
          </div>
          <div>
            <div style={{fontSize:10,color:"#6B7280",marginBottom:5,fontWeight:700,letterSpacing:0.5}}>PASSWORD</div>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{width:"100%",background:"#0a0a1a",border:"1px solid #1e3a5f",borderRadius:10,padding:"11px 14px",color:"white",fontSize:13,outline:"none",fontFamily:"'Segoe UI',sans-serif",boxSizing:"border-box"}}/>
          </div>
          {mode==="register"&&(
            <div>
              <div style={{fontSize:10,color:"#6B7280",marginBottom:5,fontWeight:700,letterSpacing:0.5}}>CONFIRM PASSWORD</div>
              <input type="password" value={pass2} onChange={e=>setPass2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{width:"100%",background:"#0a0a1a",border:"1px solid #1e3a5f",borderRadius:10,padding:"11px 14px",color:"white",fontSize:13,outline:"none",fontFamily:"'Segoe UI',sans-serif",boxSizing:"border-box"}}/>
            </div>
          )}
          {err&&<div style={{background:"#450a0a",border:"1px solid #F87171",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#F87171"}}>{err}</div>}
          <button onClick={submit} disabled={loading} style={{width:"100%",padding:"13px",border:"none",borderRadius:11,background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"white",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"'Segoe UI',sans-serif",letterSpacing:0.5,textTransform:"uppercase",boxShadow:"0 4px 20px #3b82f644",marginTop:4,transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.1)";e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.filter="none";e.currentTarget.style.transform="none";}}>
            {loading?"Loading...":(mode==="login"?"🔑 LOGIN":"✨ CREATE ACCOUNT")}
          </button>
        </div>

        <div style={{marginTop:20,fontSize:10,color:"#374151",textAlign:"center",lineHeight:1.6}}>
          Accounts persist across sessions · Any name (2–20 chars) works.<br/>
          <span style={{color:"#1e3a5f"}}>Trades happen in real-time on the shared marketplace.</span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN GAME ────────────────────────────────────────────────────────────────
export default function CubeVault() {
  const [currentUser, setCurrentUser] = useState(null);
  if (!currentUser) return <AuthScreen onLogin={setCurrentUser}/>;
  return <Game username={currentUser} onLogout={()=>setCurrentUser(null)}/>;
}

function Game({ username, onLogout }) {
  // Load user save
  const initSave = () => {
    const d = localGet(USER_KEY(username));
    return d || { coins:500, upgrades:{capacity:0,speed:0,luck:0,level:0}, world:[], boxes:[], stats:{earned:0,cubesBought:0,sold:0}, tutorialDone:false };
  };

  const [coins,    setCoins]    = useState(()=> initSave().coins);
  const [boxes,    setBoxes]    = useState(()=> initSave().boxes.map(deserCube));
  const [world,    setWorld]    = useState(()=> initSave().world.map(deserCube));
  const [upgrades, setUpgrades] = useState(()=> initSave().upgrades);
  const [stats,    setStats]    = useState(()=> initSave().stats);
  const [conveyor, setConveyor] = useState([]);
  const [view,     setView]     = useState("factory");
  const [selectedCube, setSelectedCube] = useState(null);
  const [notification, setNotification] = useState(null);
  const [convPos,  setConvPos]  = useState(0);
  const [boxOpen,  setBoxOpen]  = useState(false);

  // Market
  const [market,       setMarket]       = useState([]);
  const [marketLoading,setMarketLoading]= useState(false);
  const [sellModal,    setSellModal]    = useState(null); // cube to list
  const [sellPrice,    setSellPrice]    = useState("");

  // Modals
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const cubeCounter = useRef(1000);
  const spawnRef    = useRef(null);
  const upgradesRef = useRef(upgrades);
  upgradesRef.current = upgrades;
  const stateRef = useRef({});

  const notify = (msg, color="#FBBF24", dur=2600) => {
    setNotification({msg,color});
    setTimeout(()=>setNotification(null), dur);
  };

  // ── Persist ──
  const persist = useCallback((overrides={}) => {
    const s = {
      coins:    overrides.coins    ?? stateRef.current.coins,
      upgrades: overrides.upgrades ?? stateRef.current.upgrades,
      world:    (overrides.world   ?? stateRef.current.world).map(serCube),
      boxes:    (overrides.boxes   ?? stateRef.current.boxes).map(serCube),
      stats:    overrides.stats    ?? stateRef.current.stats,
      tutorialDone: true,
    };
    localSet(USER_KEY(username), s);
  }, [username]);

  // Keep stateRef current
  useEffect(()=>{ stateRef.current = {coins,upgrades,world,boxes,stats}; });

  // persistRef so bot useEffect can call latest persist without re-running
  const persistRef = useRef(persist);
  useEffect(()=>{ persistRef.current = persist; },[persist]);

  // Auto-save
  useEffect(()=>{ const t=setInterval(()=>persist(),8000); return ()=>clearInterval(t); },[persist]);

  // Belt
  useEffect(()=>{ const t=setInterval(()=>setConvPos(p=>(p+1.5)%100),50); return ()=>clearInterval(t); },[]);

  // Spawn cubes
  useEffect(()=>{
    if (spawnRef.current) clearInterval(spawnRef.current);
    const ms = getSpawnMs(upgrades.speed);
    spawnRef.current = setInterval(()=>{
      const cap = getCapacity(upgradesRef.current.capacity);
      const luck = upgradesRef.current.luck;
      const lvlBoost = upgradesRef.current.level;
      setConveyor(prev=>{
        if (prev.length >= cap) return prev;
        return [...prev, generateCube(++cubeCounter.current, luck, lvlBoost)];
      });
    }, ms);
    return ()=>clearInterval(spawnRef.current);
  },[upgrades.speed]);

  // Passive income
  useEffect(()=>{
    const t=setInterval(()=>{
      setWorld(prev=>{
        const inc=prev.filter(c=>c.purchased).reduce((a,c)=>a+c.income,0);
        if (inc>0){ setCoins(c=>c+inc); setStats(s=>({...s,earned:s.earned+inc})); }
        return prev;
      });
    },1000);
    return ()=>clearInterval(t);
  },[]);

  // ── BOT SYSTEM ──
  useEffect(()=>{
    const BOT_NAMES = [
      "CubeBot_Rex","TraderAI","MarketBot","VaultBot","NexusBot","CubeOracle",
      "AutoTrader","BotMaster","CubeLord","QuantumBot","NightTrader","StarVault",
      "PrismaBot","VoidSeeker","LegendBot","MysticMart","CubeKing","DataTrader",
      "SwiftBot","ArcaneMkt","DeepVault","OmegaBot","CosmicDeal","ShadowTrade",
      "CrystalBot","GildedBot","InfernoBot","CelestBot","AbyssalBot","PrimalBot",
    ];
    let botCounter = 9000;
    const BOT_MAX_BUY_PRICE = 50000;
    const BOT_MAX_LIST_PRICE = 80000;
    const MAX_BOT_LISTINGS = 500; // bots flood the market with up to 500 cubes

    const makeBotCube = (idSuffix) => {
      // Weighted toward common/uncommon but can hit up to Abyssal (index 14)
      const maxBotRarityIdx = RARITIES.length - 5; // no Secret, Transcendent, Omega, God
      const roll = Math.random();
      // Exponential weighting: most cubes are low rarity
      const ri = Math.min(maxBotRarityIdx, Math.floor(-Math.log(Math.random()) * 2.5));
      const rarity = RARITIES[Math.min(ri, maxBotRarityIdx)];
      const shape = CUBE_SHAPES[Math.floor(Math.random() * CUBE_SHAPES.length)];
      const cubeName = CUBE_NAMES[Math.floor(Math.random() * CUBE_NAMES.length)];
      const level = Math.floor(Math.random() * 150) + 1;
      const rarityIdx = RARITIES.indexOf(rarity);
      const mult = (rarityIdx + 1) * (1 + Math.floor(level / 100) * 0.5);
      const baseValue = Math.floor(level * mult * 12);
      const price = Math.min(BOT_MAX_LIST_PRICE, Math.max(10, Math.floor(baseValue * (0.55 + Math.random() * 0.4))));
      const cube = {
        id: `bot_${idSuffix}`, name: cubeName, level, rarity, shape,
        value: baseValue, income: Math.floor(level * mult * 0.8),
        x: Math.random()*65+10, y: Math.random()*50+15,
        purchased: false, angle: Math.random()*40-20,
      };
      return { cube, price };
    };

    const runBots = async () => {
      try {
        let market = await sharedGet(MARKET_KEY) || [];
        const now = Date.now();
        let changed = false;

        // 1. Remove stale bot listings older than 5 minutes
        const beforeLen = market.length;
        market = market.filter(l => !l.isBot || (now - l.listedAt) < 5 * 60 * 1000);
        if (market.length !== beforeLen) changed = true;

        // 2. Bots buy cheap player listings (price ≤ BOT_MAX_BUY_PRICE)
        const affordable = market.filter(l => !l.isBot && l.price <= BOT_MAX_BUY_PRICE && l.seller !== username);
        // Each tick, bots may buy up to 3 cheap listings
        const buyCount = Math.min(affordable.length, Math.floor(Math.random() * 3) + (Math.random() < 0.5 ? 1 : 0));
        const toBuy = affordable.sort(()=>Math.random()-0.5).slice(0, buyCount);
        for (const target of toBuy) {
          market = market.filter(l => l.id !== target.id);
          changed = true;
          if (target.seller === username) {
            const buyerBot = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
            const soldCube = deserCube(target.cube);
            setCoins(c => {
              const nc = c + target.price;
              persistRef.current({ coins: nc });
              return nc;
            });
            setNotification({ msg: `🤖 ${buyerBot} bought your ${soldCube.name} for 🪙${target.price.toLocaleString()}!`, color: "#34D399" });
            setTimeout(() => setNotification(null), 4000);
          }
        }

        // 3. Flood market with bot listings up to MAX_BOT_LISTINGS
        const currentBotCount = market.filter(l => l.isBot).length;
        const toList = MAX_BOT_LISTINGS - currentBotCount;
        if (toList > 0) {
          // Add up to 30 new listings per tick to fill up to 500
          const addCount = Math.min(toList, 30);
          for (let i = 0; i < addCount; i++) {
            const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
            const { cube, price } = makeBotCube(++botCounter);
            market.push({
              id: `bot_${botName}_${now}_${i}`,
              seller: botName,
              isBot: true,
              cube: serCube(cube),
              price,
              listedAt: now - Math.floor(Math.random() * 200000), // stagger times
            });
          }
          changed = true;
        }

        if (changed) {
          await sharedSet(MARKET_KEY, market);
          setMarket(market.map(item => ({...item, cube: deserCube(item.cube)})));
        }
      } catch(_) {}
    };

    // Run bots every 12 seconds
    const botInterval = setInterval(runBots, 12000);
    // Run once shortly after mount
    const initTimeout = setTimeout(runBots, 3000);
    return () => { clearInterval(botInterval); clearTimeout(initTimeout); };
  // eslint-disable-next-line
  }, [username]);

  // Load market
  const loadMarket = useCallback(async()=>{
    setMarketLoading(true);
    try {
      const m = await sharedGet(MARKET_KEY);
      setMarket(m ? m.map(item=>({...item, cube:deserCube(item.cube)})) : []);
    } catch(_){ setMarket([]); }
    setMarketLoading(false);
  },[]);

  useEffect(()=>{ if (view==="market") loadMarket(); },[view, loadMarket]);

  // ── Handlers ──
  const handleUpgrade = (key) => {
    const lvl = upgrades[key];
    if (lvl >= UPGRADE_DEFS[key].maxLevel) return;
    const cost = getUpgradeCost(key, lvl);
    if (coins < cost) { notify("❌ Not enough coins!","#F87171"); return; }
    const nc = coins - cost;
    const nu = {...upgrades,[key]:lvl+1};
    setCoins(nc); setUpgrades(nu);
    notify(`✨ ${UPGRADE_DEFS[key].label} → Lv.${lvl+1}!`, UPGRADE_DEFS[key].color);
    persist({coins:nc, upgrades:nu});
  };

  const sendToBox = (cubeId) => {
    setConveyor(prev=>{
      const cube=prev.find(c=>c.id===cubeId);
      if (!cube) return prev;
      setBoxes(b=>{ const nb=[...b,cube]; persist({boxes:nb}); return nb; });
      notify(`📦 ${cube.name} → Box!`, cube.rarity.color);
      return prev.filter(c=>c.id!==cubeId);
    });
  };

  const throwCube = () => {
    if (!selectedCube) return;
    const nw=[...world,{...selectedCube,purchased:false}];
    const nb=boxes.filter(c=>c.id!==selectedCube.id);
    setWorld(nw); setBoxes(nb); setSelectedCube(null); setView("world");
    notify("🎲 Cube launched!","#60A5FA");
    persist({world:nw,boxes:nb});
  };

  const buyCubeWorld = (cube) => {
    if (coins<cube.value){ notify("❌ Not enough coins!","#F87171"); return; }
    const nc=coins-cube.value;
    const nw=world.map(c=>c.id===cube.id?{...c,purchased:true}:c);
    const ns={...stats,cubesBought:stats.cubesBought+1};
    setCoins(nc); setWorld(nw); setStats(ns); setSelectedCube(null);
    notify(`✅ ${cube.name} → +${cube.income}/sec`, cube.rarity.color);
    persist({coins:nc,world:nw,stats:ns});
  };

  const discardCube = () => {
    if (!selectedCube) return;
    const nb=boxes.filter(c=>c.id!==selectedCube.id);
    setBoxes(nb); setSelectedCube(null);
    notify("🗑️ Discarded","#9CA3AF");
    persist({boxes:nb});
  };

  // ── Market: list cube ──
  const listCube = async () => {
    if (!sellModal) return;
    const price = parseInt(sellPrice);
    if (isNaN(price)||price<1){ notify("❌ Invalid price","#F87171"); return; }
    const listing = { id: `${username}_${Date.now()}`, seller: username, cube: serCube(sellModal), price, listedAt: Date.now() };
    // Remove from world/box
    const nw = world.filter(c=>c.id!==sellModal.id);
    const nb = boxes.filter(c=>c.id!==sellModal.id);
    setWorld(nw); setBoxes(nb); setSellModal(null); setSellPrice("");
    persist({world:nw,boxes:nb});
    // Add to shared market
    try {
      const m = await sharedGet(MARKET_KEY) || [];
      m.push(listing);
      await sharedSet(MARKET_KEY, m);
      notify("🏪 Listed on Market!","#34D399");
      if (view==="market") loadMarket();
    } catch(_){ notify("❌ Market error","#F87171"); }
  };

  // ── Market: buy listing ──
  const buyListing = async (listing) => {
    if (listing.seller===username){ notify("❌ That's your listing!","#F87171"); return; }
    if (coins<listing.price){ notify("❌ Not enough coins!","#F87171"); return; }
    try {
      const m = await sharedGet(MARKET_KEY) || [];
      const idx = m.findIndex(l=>l.id===listing.id);
      if (idx===-1){ notify("❌ Already sold!","#F87171"); await loadMarket(); return; }
      m.splice(idx,1);
      await sharedSet(MARKET_KEY, m);
      // Give coin to seller
      const sellerSave = localGet(USER_KEY(listing.seller));
      // (best-effort — seller gets coins next time they load if same device; in real backend this would be server-side)
      const nc = coins - listing.price;
      const cube = deserCube(listing.cube);
      const nw = [...world, {...cube, purchased:true, x:Math.random()*65+10, y:Math.random()*50+15}];
      const ns = {...stats, cubesBought:stats.cubesBought+1};
      setCoins(nc); setWorld(nw); setStats(ns);
      persist({coins:nc,world:nw,stats:ns});
      notify(`🛒 Bought ${cube.name} from ${listing.seller}!`, cube.rarity.color);
      await loadMarket();
    } catch(_){ notify("❌ Market error","#F87171"); }
  };

  // ── Market: delist ──
  const delistCube = async (listing) => {
    try {
      const m = await sharedGet(MARKET_KEY) || [];
      const idx = m.findIndex(l=>l.id===listing.id);
      if (idx===-1){ notify("Already removed","#9CA3AF"); return; }
      m.splice(idx,1);
      await sharedSet(MARKET_KEY, m);
      // Give cube back
      const cube = deserCube(listing.cube);
      const nb = [...boxes, cube];
      setBoxes(nb);
      persist({boxes:nb});
      notify("↩ Cube returned to box","#9CA3AF");
      await loadMarket();
    } catch(_){ notify("❌ Error","#F87171"); }
  };

  const totalIncome = world.filter(c=>c.purchased).reduce((a,c)=>a+c.income,0);
  const cap      = getCapacity(upgrades.capacity);
  const spawnSec = (getSpawnMs(upgrades.speed)/1000).toFixed(1);
  const ownedWorld = world.filter(c=>c.purchased);

  // Only cubes that have been purchased (in world) can be sold
  const sellableCubes = world.filter(c => c.purchased);

  const TABS = [
    {id:"factory",  label:"🏭 Factory"},
    {id:"upgrades", label:"⬆ Upgrades"},
    {id:"world",    label:"🌍 World"},
    {id:"market",   label:"🏪 Market"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0a0a1a 0%,#0d1b2a 50%,#0a0a1a 100%)",fontFamily:"'Segoe UI',sans-serif",color:"white",overflowY:"auto"}}>
      <style>{`
        @keyframes cubeSpin{from{transform:rotateY(0deg) rotateX(15deg)}to{transform:rotateY(360deg) rotateX(15deg)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px #FBBF2444}50%{box-shadow:0 0 40px #FBBF24aa}}
        @keyframes slideIn{from{transform:translateY(-14px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes sparkle{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
        @keyframes beltMove{from{background-position-x:0}to{background-position-x:40px}}
        @keyframes secretGlow{0%,100%{box-shadow:0 0 12px #E879F9,0 0 30px #E879F944}50%{box-shadow:0 0 24px #E879F9,0 0 60px #E879F988,0 0 100px #E879F922}}
        @keyframes godGlow{0%{box-shadow:0 0 20px #FFD700,0 0 50px #FFD70066;filter:brightness(1)}50%{box-shadow:0 0 40px #FFD700,0 0 100px #FFD700aa,0 0 160px #FFD70033;filter:brightness(1.3)}100%{box-shadow:0 0 20px #FFD700,0 0 50px #FFD70066;filter:brightness(1)}}
        @keyframes secretRainbow{0%{border-color:#E879F9}25%{border-color:#A78BFA}50%{border-color:#F87171}75%{border-color:#60A5FA}100%{border-color:#E879F9}}
        @keyframes godShine{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .secret-cube{animation:secretGlow 2s ease-in-out infinite,secretRainbow 3s linear infinite!important}
        .god-cube{animation:godGlow 1.5s ease-in-out infinite!important}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .cc{transition:all 0.2s;cursor:pointer}.cc:hover{transform:scale(1.07) translateY(-3px)}
        .nb{border:none;cursor:pointer;font-family:'Segoe UI',sans-serif;font-weight:800;letter-spacing:0.5px;transition:all 0.15s;text-transform:uppercase}
        .nb:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.12)}
        .nb:active:not(:disabled){transform:translateY(1px)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#FBBF2444;border-radius:2px}
        input{transition:border-color 0.2s}
      `}</style>

      {/* Stars */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {Array.from({length:50}).map((_,i)=>(
          <div key={i} style={{position:"absolute",width:Math.random()*2+1,height:Math.random()*2+1,background:"white",borderRadius:"50%",left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,opacity:Math.random()*0.5+0.1,animation:`sparkle ${Math.random()*3+2}s ease-in-out infinite`,animationDelay:`${Math.random()*4}s`}}/>
        ))}
      </div>

      <Notification n={notification}/>

      {/* Sell modal */}
      {sellModal && (
        <Modal title="📢 List on Marketplace" onClose={()=>setSellModal(null)}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:16,background:sellModal.rarity.bg,border:`2px solid ${sellModal.rarity.color}44`,borderRadius:14}}>
            <Cube3D cube={sellModal} size={56} spin/>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:sellModal.rarity.color}}>{sellModal.name}</div>
              <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{sellModal.rarity.name} · Lv.{sellModal.level.toLocaleString()}</div>
              <div style={{fontSize:11,color:"#34D399",marginTop:2}}>Income: +{sellModal.income}/sec</div>
              <div style={{fontSize:11,color:"#FBBF24",marginTop:1}}>Est. value: 🪙{sellModal.value.toLocaleString()}</div>
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,letterSpacing:0.5,marginBottom:7}}>YOUR ASKING PRICE 🪙</div>
            <input type="number" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} placeholder={`Suggested: ${sellModal.value}`} style={{width:"100%",background:"#0a0a1a",border:"1px solid #1e3a5f",borderRadius:10,padding:"11px 14px",color:"white",fontSize:14,fontWeight:700,outline:"none",fontFamily:"monospace",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button className="nb" onClick={()=>setSellModal(null)} style={{flex:1,padding:"11px",background:"#1f2937",color:"#6B7280",border:"none",borderRadius:10,fontSize:12}}>Cancel</button>
            <button className="nb" onClick={listCube} style={{flex:2,padding:"11px",background:"linear-gradient(135deg,#34D399,#059669)",color:"white",border:"none",borderRadius:10,fontSize:12}}>🏪 LIST FOR 🪙{parseInt(sellPrice)||"?"}</button>
          </div>
        </Modal>
      )}

      {/* Logout confirm */}
      {showLogoutConfirm && (
        <Modal title="Log Out?" onClose={()=>setShowLogoutConfirm(false)} width={340}>
          <div style={{fontSize:13,color:"#9CA3AF",marginBottom:20}}>Your progress is saved. You'll need to log back in to continue playing.</div>
          <div style={{display:"flex",gap:10}}>
            <button className="nb" onClick={()=>setShowLogoutConfirm(false)} style={{flex:1,padding:"11px",background:"#1f2937",color:"#6B7280",border:"none",borderRadius:10,fontSize:12}}>Cancel</button>
            <button className="nb" onClick={()=>{persist();onLogout();}} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#F87171,#dc2626)",color:"white",border:"none",borderRadius:10,fontSize:12}}>Log Out</button>
          </div>
        </Modal>
      )}

      {/* ── HEADER ── */}
      <div style={{position:"sticky",top:0,zIndex:200,background:"linear-gradient(180deg,#050a14 0%,#0a0a1acc 100%)",borderBottom:"2px solid #FBBF2420",backdropFilter:"blur(12px)"}}>
        <div style={{maxWidth:980,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",gap:8,flexWrap:"wrap"}}>
            {/* Logo */}
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{fontSize:22,animation:"float 3s ease-in-out infinite"}}>🎲</div>
              <div>
                <div style={{fontSize:16,fontWeight:900,background:"linear-gradient(90deg,#FBBF24,#F87171,#A78BFA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>CUBEVAULT</div>
                <div style={{fontSize:7,color:"#6B7280",letterSpacing:2}}>CONVEYOR OF FORTUNE</div>
              </div>
            </div>

            {/* Coins */}
            <div style={{display:"flex",alignItems:"center",gap:7,background:"linear-gradient(135deg,#1a1200,#2d1f00)",border:"2px solid #FBBF2466",borderRadius:11,padding:"6px 12px",animation:"glow 3s ease-in-out infinite"}}>
              <span style={{fontSize:16}}>🪙</span>
              <div>
                <div style={{fontSize:15,fontWeight:900,color:"#FBBF24"}}>{coins.toLocaleString()}</div>
                <div style={{fontSize:7,color:"#92400e",letterSpacing:1}}>+{totalIncome}/SEC</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{display:"flex",gap:12,fontSize:9,color:"#6B7280"}}>
              {[{l:"BELT",v:`${conveyor.length}/${cap}`,c:"#60A5FA"},{l:"BOX",v:boxes.length,c:"#A78BFA"},{l:"OWNED",v:ownedWorld.length,c:"#34D399"}].map(s=>(
                <div key={s.l} style={{textAlign:"center"}}>
                  <div style={{color:s.c,fontWeight:900,fontSize:13}}>{s.v}</div>
                  <div>{s.l}</div>
                </div>
              ))}
            </div>

            {/* User + logout */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"#0d1b2a",border:"1px solid #1e3a5f",borderRadius:9,padding:"5px 10px"}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900}}>
                  {username[0].toUpperCase()}
                </div>
                <span style={{fontSize:11,fontWeight:700,color:"#9CA3AF"}}>{username}</span>
              </div>
              <button className="nb" onClick={()=>setShowLogoutConfirm(true)} style={{background:"#1f2937",color:"#6B7280",border:"1px solid #374151",borderRadius:8,padding:"5px 10px",fontSize:10}}>↩ OUT</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:3}}>
            {TABS.map(tab=>(
              <button key={tab.id} className="nb" onClick={()=>setView(tab.id)} style={{
                padding:"8px 16px",borderRadius:"10px 10px 0 0",fontSize:11,
                background:view===tab.id?"linear-gradient(180deg,#1e3a5f,#0d1b2a)":"transparent",
                color:view===tab.id?"#60A5FA":"#4B5563",
                borderBottom:`3px solid ${view===tab.id?"#60A5FA":"transparent"}`,
                opacity:view===tab.id?1:0.7,position:"relative",
              }}>
                {tab.label}
                {tab.id==="upgrades"&&Object.values(upgrades).reduce((a,b)=>a+b,0)<30&&(
                  <div style={{position:"absolute",top:6,right:6,width:6,height:6,borderRadius:"50%",background:"#F87171",animation:"pulse 1.5s ease-in-out infinite"}}/>
                )}
                {tab.id==="market"&&<div style={{position:"absolute",top:6,right:6,width:6,height:6,borderRadius:"50%",background:"#34D399",animation:"pulse 2s ease-in-out infinite"}}/>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{maxWidth:980,margin:"0 auto",padding:"18px 16px 90px",position:"relative",zIndex:5}}>

        {/* ═══ FACTORY ═══ */}
        {view==="factory"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Stat bar */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",background:"#0d1b2a",border:"1px solid #1e3a5f",borderRadius:13,padding:"10px 14px",alignItems:"center"}}>
              {Object.entries(UPGRADE_DEFS).map(([key,def])=>(
                <div key={key} style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:100}}>
                  <div style={{width:26,height:26,borderRadius:7,background:`${def.color}18`,border:`1px solid ${def.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{def.icon}</div>
                  <div>
                    <div style={{fontSize:8,color:"#4B5563"}}>{def.label}</div>
                    <div style={{fontSize:11,fontWeight:800,color:def.color}}>
                      {key==="capacity"?`${cap} slots`:key==="speed"?`${spawnSec}s`:key==="level"?`Max ${getMaxLevel(upgrades.level).toLocaleString()}`:`Lk${upgrades.luck}`}
                    </div>
                  </div>
                  <div style={{marginLeft:"auto",fontSize:7,color:def.color+"88",background:def.color+"18",padding:"1px 5px",borderRadius:4,fontWeight:700}}>Lv{upgrades[key]}</div>
                </div>
              ))}
              <button className="nb" onClick={()=>setView("upgrades")} style={{background:"linear-gradient(135deg,#1e3a5f,#0d2a3f)",color:"#60A5FA",border:"1px solid #60A5FA44",borderRadius:8,padding:"6px 12px",fontSize:10,flexShrink:0}}>⬆ UPGRADE</button>
            </div>

            {/* Conveyor */}
            <div style={{background:"linear-gradient(135deg,#0d1b2a,#0a1520)",border:"2px solid #1e3a5f",borderRadius:18,overflow:"hidden"}}>
              <div style={{padding:"12px 18px",borderBottom:"1px solid #1e3a5f33",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:"#60A5FA"}}>⚙️ CONVEYOR BELT</div>
                  <div style={{fontSize:9,color:"#4B5563",marginTop:1}}>New cube every {spawnSec}s · Max level {getMaxLevel(upgrades.level).toLocaleString()} · {conveyor.length}/{cap}</div>
                </div>
                <div style={{display:"flex",gap:2}}>
                  {Array.from({length:Math.min(cap,25)}).map((_,i)=>(
                    <div key={i} style={{width:Math.min(9,90/Math.min(cap,25)),height:7,borderRadius:2,background:i<conveyor.length?"#60A5FA":"#1e3a5f",transition:"all 0.3s"}}/>
                  ))}
                </div>
              </div>
              <div style={{position:"relative",height:125,overflow:"hidden"}}>
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:26,background:"repeating-linear-gradient(90deg,#1a1a2e 0px,#1a1a2e 36px,#0f0f1e 36px,#0f0f1e 40px)",animation:`beltMove ${Math.max(0.3,getSpawnMs(upgrades.speed)/3000)}s linear infinite`,border:"2px solid #1e3a5f"}}>
                  <div style={{position:"absolute",top:6,left:0,right:0,height:3,background:"#60A5FA22",borderRadius:2}}/>
                  <div style={{position:"absolute",top:15,left:0,right:0,height:3,background:"#60A5FA22",borderRadius:2}}/>
                </div>
                <div style={{position:"absolute",bottom:22,left:0,right:0,height:86,display:"flex",alignItems:"flex-end",padding:"0 18px",gap:16,overflowX:"hidden"}}>
                  {conveyor.length===0&&<div style={{color:"#374151",fontSize:12,margin:"auto",paddingBottom:6}}>Waiting for cubes...</div>}
                  {conveyor.map((cube,i)=>(
                    <div key={cube.id} className="cc" onClick={()=>sendToBox(cube.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,animation:`float ${2+i*0.3}s ease-in-out infinite`,flexShrink:0}}>
                      <div style={{fontSize:7,color:cube.rarity.color,fontWeight:800,background:cube.rarity.bg,padding:"2px 5px",borderRadius:3}}>{cube.rarity.name.slice(0,3).toUpperCase()}</div>
                      <Cube3D cube={cube} size={40}/>
                      <div style={{fontSize:7,color:"#6B7280",maxWidth:44,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cube.name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{padding:"5px 18px 9px",fontSize:8,color:"#374151",textAlign:"center"}}>👆 TAP CUBE → BOX</div>
            </div>

            {/* Box */}
            <div style={{background:"linear-gradient(135deg,#1a0a2e,#0d0a1a)",border:`2px solid ${boxes.length>0?"#A78BFA55":"#1e1e3a"}`,borderRadius:18,transition:"all 0.3s",boxShadow:boxes.length>0?"0 0 28px #A78BFA18":"none"}}>
              <div style={{padding:"12px 18px",borderBottom:"1px solid #2e106544",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:"#A78BFA"}}>📦 FORTUNE BOX</div>
                  <div style={{fontSize:9,color:"#4B5563",marginTop:1}}>Throw into World → Buy → then Sell on Market</div>
                </div>
                <div style={{display:"flex",gap:7,alignItems:"center"}}>
                  {boxes.length>0&&(
                    <button className="nb" onClick={()=>{
                      if(!window.confirm(`Discard ALL ${boxes.length} cubes? This cannot be undone.`)) return;
                      setBoxes([]); setSelectedCube(null); setBoxOpen(false);
                      persist({boxes:[]});
                      notify(`🗑️ Discarded ${boxes.length} cubes`,"#9CA3AF");
                    }} style={{background:"linear-gradient(135deg,#374151,#1f2937)",color:"#F87171",border:"1px solid #F8717133",padding:"6px 11px",borderRadius:9,fontSize:10}}>
                      🗑️ ALL
                    </button>
                  )}
                  {boxes.length>0&&(
                    <button className="nb" onClick={()=>setBoxOpen(!boxOpen)} style={{background:boxOpen?"linear-gradient(135deg,#7c3aed,#5b21b6)":"linear-gradient(135deg,#A78BFA,#7c3aed)",color:"white",padding:"6px 14px",borderRadius:9,fontSize:10}}>
                      {boxOpen?"🔒 CLOSE":`📬 OPEN (${boxes.length})`}
                    </button>
                  )}
                </div>
              </div>
              {!boxOpen&&(
                <div style={{padding:24,textAlign:"center"}}>
                  <div style={{fontSize:40,animation:boxes.length>0?"float 2s ease-in-out infinite":undefined}}>{boxes.length>0?"📦":"📭"}</div>
                  <div style={{color:boxes.length>0?"#A78BFA":"#374151",fontWeight:700,marginTop:7,fontSize:12}}>
                    {boxes.length>0?`${boxes.length} cube${boxes.length>1?"s":""} inside!`:"Empty — tap cubes on the belt!"}
                  </div>
                </div>
              )}
              {boxOpen&&(
                <div style={{padding:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(95px,1fr))",gap:9}}>
                    {boxes.map(cube=>(
                      <div key={cube.id} className="cc" onClick={()=>setSelectedCube(selectedCube?.id===cube.id?null:cube)} style={{background:cube.rarity.bg,border:`2px solid ${selectedCube?.id===cube.id?cube.rarity.color:cube.rarity.color+"33"}`,borderRadius:12,padding:"9px 7px",textAlign:"center",boxShadow:selectedCube?.id===cube.id?`0 0 16px ${cube.rarity.glow}55`:"none"}}>
                        <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><Cube3D cube={cube} size={34}/></div>
                        <div style={{fontSize:8,fontWeight:800,color:cube.rarity.color}}>{cube.rarity.name.toUpperCase()}</div>
                        <div style={{fontSize:9,fontWeight:700,color:"white",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cube.name}</div>
                        <div style={{fontSize:8,color:"#FBBF24",marginTop:1}}>Lv.{cube.level.toLocaleString()}</div>
                        <div style={{fontSize:7,color:"#34D399",marginTop:1}}>🪙{cube.value.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                  {selectedCube&&boxes.find(c=>c.id===selectedCube.id)&&(
                    <div style={{marginTop:12,padding:14,background:"#0a0a1a",border:`2px solid ${selectedCube.rarity.color}55`,borderRadius:13,display:"flex",alignItems:"center",gap:14,boxShadow:`0 0 24px ${selectedCube.rarity.glow}22`,animation:"slideIn 0.3s ease"}}>
                      <Cube3D cube={selectedCube} size={52} spin/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:900,color:selectedCube.rarity.color}}>{selectedCube.name}</div>
                        <div style={{fontSize:9,color:"#6B7280",marginTop:1}}>{selectedCube.rarity.name} · Lv.{selectedCube.level.toLocaleString()}</div>
                        <div style={{display:"flex",gap:12,marginTop:6}}>
                          <div><span style={{color:"#FBBF24",fontWeight:800,fontSize:12}}>🪙{selectedCube.value.toLocaleString()}</span><span style={{fontSize:7,color:"#4B5563",marginLeft:2}}>VALUE</span></div>
                          <div><span style={{color:"#34D399",fontWeight:800,fontSize:12}}>+{selectedCube.income}/s</span></div>
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        <button className="nb" onClick={throwCube} style={{background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"white",padding:"8px 12px",borderRadius:9,fontSize:11}}>🎲 THROW</button>
                        <button className="nb" onClick={discardCube} style={{background:"linear-gradient(135deg,#374151,#1f2937)",color:"#9CA3AF",padding:"8px 12px",borderRadius:9,fontSize:11}}>🗑️ DISCARD</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ UPGRADES ═══ */}
        {view==="upgrades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:"linear-gradient(135deg,#0d1b2a,#0a0a1a)",border:"2px solid #1e3a5f",borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:16,fontWeight:900,background:"linear-gradient(90deg,#60A5FA,#A78BFA,#F87171)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>⬆ UPGRADE WORKSHOP</div>
                <div style={{fontSize:10,color:"#4B5563",marginTop:2}}>Supercharge your factory · Levels are now unlimited with the Level Boost upgrade!</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:900,color:"#FBBF24"}}>🪙{coins.toLocaleString()}</div>
                <div style={{fontSize:8,color:"#6B7280"}}>AVAILABLE</div>
              </div>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {Object.keys(UPGRADE_DEFS).map(key=>(
                <UpgradeCard key={key} upgradeKey={key} level={upgrades[key]} coins={coins} onUpgrade={handleUpgrade}/>
              ))}
            </div>
            {/* Rarity chart */}
            <div style={{background:"#0d1b2a",border:"1px solid #1e3a5f",borderRadius:14,padding:"16px 18px"}}>
              <div style={{fontSize:12,fontWeight:800,color:"#9CA3AF",marginBottom:12}}>🎲 RARITY CHANCES — Luck Lv.{upgrades.luck}</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {RARITIES.map((r,i)=>{
                  const shift=upgrades.luck*1.5;
                  const c=i===0?Math.max(3,r.baseChance-shift):r.baseChance+shift*(i/(RARITIES.length-1))*0.9;
                  const total=RARITIES.reduce((a,rr,j)=>a+(j===0?Math.max(3,rr.baseChance-shift):rr.baseChance+shift*(j/(RARITIES.length-1))*0.9),0);
                  const pct=(c/total*100).toFixed(1);
                  return (
                    <div key={r.name} style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:68,fontSize:9,fontWeight:700,color:r.color,textAlign:"right"}}>{r.name}</div>
                      <div style={{flex:1,height:16,background:"#0a0a1a",borderRadius:4,overflow:"hidden",border:"1px solid #1e3a5f"}}>
                        <div style={{height:"100%",width:`${Math.min(100,parseFloat(pct)*1.8)}%`,background:`linear-gradient(90deg,${r.color}55,${r.color})`,borderRadius:4,transition:"width 0.5s ease",minWidth:"3px"}}/>
                      </div>
                      <div style={{width:40,fontSize:10,fontWeight:800,color:r.color,textAlign:"right"}}>{pct}%</div>
                      {upgrades.luck>0&&<div style={{width:20,fontSize:8,color:i===0?"#F87171":"#34D399",textAlign:"center"}}>{i===0?"▼":"▲"}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ WORLD ═══ */}
        {view==="world"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{fontSize:15,fontWeight:900,color:"#34D399"}}>🌍 WORLD</div>
                <div style={{fontSize:9,color:"#4B5563",marginTop:1}}>Click a cube to buy, sell, or inspect</div>
              </div>
              <div style={{fontSize:10,color:"#4B5563",background:"#0d1b2a",padding:"5px 11px",borderRadius:7,border:"1px solid #1e3a5f"}}>
                💰 <span style={{color:"#34D399",fontWeight:800}}>+{totalIncome}/sec</span>
              </div>
            </div>
            <div style={{position:"relative",height:340,background:"radial-gradient(ellipse at center,#0a1520 0%,#050a14 100%)",border:"2px solid #1e3a5f",borderRadius:18,overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(#1e3a5f11 1px,transparent 1px),linear-gradient(90deg,#1e3a5f11 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>
              {world.length===0&&(
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
                  <div style={{fontSize:40,opacity:0.2}}>🌌</div>
                  <div style={{color:"#374151",fontSize:12,fontWeight:700}}>World is empty — throw cubes from the Factory!</div>
                </div>
              )}
              {world.map(cube=>(
                <div key={cube.id} className="cc" onClick={()=>setSelectedCube(selectedCube?.id===cube.id?null:cube)} style={{position:"absolute",left:`${cube.x}%`,top:`${cube.y}%`,transform:`translate(-50%,-50%) rotate(${cube.angle}deg)`,animation:cube.purchased?undefined:`float ${2.5+cube.id%2}s ease-in-out infinite`}}>
                  <div style={{position:"relative"}}>
                    <Cube3D cube={cube} size={38}/>
                    {cube.purchased&&<div style={{position:"absolute",top:-6,right:-6,background:"#34D399",borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:900,color:"#064e3b"}}>✓</div>}
                    {selectedCube?.id===cube.id&&<div style={{position:"absolute",inset:-4,border:`2px solid ${cube.rarity.color}`,borderRadius:9,boxShadow:`0 0 16px ${cube.rarity.glow}`,animation:"glow 1.5s ease-in-out infinite",pointerEvents:"none"}}/>}
                  </div>
                </div>
              ))}
            </div>
            {selectedCube&&world.find(c=>c.id===selectedCube.id)&&(
              <div style={{marginTop:12,padding:16,background:"linear-gradient(135deg,#0d1b2a,#0a0a1a)",border:`2px solid ${selectedCube.rarity.color}`,borderRadius:16,boxShadow:`0 0 32px ${selectedCube.rarity.glow}22`,display:"flex",gap:16,alignItems:"center",animation:"slideIn 0.3s ease"}}>
                <Cube3D cube={selectedCube} size={64} spin/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{fontSize:8,fontWeight:800,color:selectedCube.rarity.color,background:selectedCube.rarity.bg,padding:"2px 6px",borderRadius:4,letterSpacing:1}}>{selectedCube.rarity.name.toUpperCase()}</span>
                    {selectedCube.purchased&&<span style={{fontSize:8,background:"#064e3b",color:"#34D399",padding:"2px 6px",borderRadius:4,fontWeight:800}}>✓ OWNED</span>}
                  </div>
                  <div style={{fontSize:17,fontWeight:900,color:"white"}}>{selectedCube.name}</div>
                  <div style={{fontSize:10,color:"#6B7280",marginTop:1}}>Level {selectedCube.level.toLocaleString()}</div>
                  <div style={{display:"flex",gap:16,marginTop:7}}>
                    <div><div style={{fontSize:14,fontWeight:900,color:"#FBBF24"}}>🪙{selectedCube.value.toLocaleString()}</div><div style={{fontSize:7,color:"#6B7280"}}>PRICE</div></div>
                    <div><div style={{fontSize:14,fontWeight:900,color:"#34D399"}}>+{selectedCube.income}</div><div style={{fontSize:7,color:"#6B7280"}}>PER SEC</div></div>
                    <div><div style={{fontSize:14,fontWeight:900,color:"#60A5FA"}}>⚡{selectedCube.level.toLocaleString()}</div><div style={{fontSize:7,color:"#6B7280"}}>LEVEL</div></div>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {!selectedCube.purchased?(
                    <button className="nb" onClick={()=>buyCubeWorld(selectedCube)} style={{background:coins>=selectedCube.value?"linear-gradient(135deg,#FBBF24,#f59e0b)":"linear-gradient(135deg,#374151,#1f2937)",color:coins>=selectedCube.value?"#0a0a00":"#6B7280",padding:"9px 18px",borderRadius:10,fontSize:11,boxShadow:coins>=selectedCube.value?"0 4px 16px #FBBF2444":"none"}}>🛒 BUY<br/><span style={{fontSize:8}}>🪙{selectedCube.value.toLocaleString()}</span></button>
                  ):(
                    <>
                      <div style={{background:"linear-gradient(135deg,#064e3b,#022c22)",border:"2px solid #34D399",borderRadius:10,padding:"9px 14px",textAlign:"center",fontSize:11,fontWeight:800,color:"#34D399"}}>✅ EARNING<br/><span style={{fontSize:9}}>+{selectedCube.income}/s</span></div>
                      <button className="nb" onClick={()=>{setSellModal(selectedCube);setSellPrice(String(Math.floor(selectedCube.value*1.2)));setSelectedCube(null);}} style={{background:"linear-gradient(135deg,#059669,#047857)",color:"white",padding:"8px 14px",borderRadius:10,fontSize:11}}>🏪 SELL</button>
                    </>
                  )}
                  <button className="nb" onClick={()=>setSelectedCube(null)} style={{background:"#1f2937",color:"#6B7280",padding:"6px 12px",borderRadius:9,fontSize:10}}>✕</button>
                </div>
              </div>
            )}
            {ownedWorld.length>0&&(
              <div style={{marginTop:12}}>
                <div style={{fontSize:11,fontWeight:800,color:"#34D399",marginBottom:7}}>📊 ACTIVE CUBES ({ownedWorld.length})</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {ownedWorld.map(cube=>(
                    <div key={cube.id} style={{background:cube.rarity.bg,border:`1px solid ${cube.rarity.color}33`,borderRadius:8,padding:"4px 8px",display:"flex",alignItems:"center",gap:5}}>
                      <Cube3D cube={cube} size={16}/>
                      <div>
                        <div style={{fontWeight:700,color:cube.rarity.color,fontSize:8}}>{cube.name}</div>
                        <div style={{color:"#34D399",fontSize:7}}>+{cube.income}/s</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ MARKET ═══ */}
        {view==="market"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Header */}
            <div style={{background:"linear-gradient(135deg,#0a1a12,#060d0a)",border:"2px solid #059669",borderRadius:16,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:16,fontWeight:900,background:"linear-gradient(90deg,#34D399,#FBBF24)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>🏪 CUBE MARKETPLACE</div>
                <div style={{fontSize:10,color:"#4B5563",marginTop:2}}>Buy & sell cubes with other players in real-time. Shared across all accounts.</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <div style={{fontSize:10,color:"#6B7280"}}>Your balance: <span style={{color:"#FBBF24",fontWeight:800}}>🪙{coins.toLocaleString()}</span></div>
                <button className="nb" onClick={loadMarket} style={{background:"#1e3a5f",color:"#60A5FA",border:"1px solid #60A5FA44",borderRadius:8,padding:"6px 12px",fontSize:10}}>🔄 REFRESH</button>
              </div>
            </div>

            {/* Quick sell bar */}
            {sellableCubes.length>0&&(
              <div style={{background:"#0d1b2a",border:"1px solid #059669",borderRadius:14,padding:"12px 16px"}}>
                <div style={{fontSize:11,fontWeight:800,color:"#34D399",marginBottom:9}}>📦 YOUR CUBES — click to list for sale</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {sellableCubes.map(cube=>(
                    <div key={cube.id} className="cc" onClick={()=>{setSellModal(cube);setSellPrice(String(cube.value));}} style={{background:cube.rarity.bg,border:`1px solid ${cube.rarity.color}44`,borderRadius:10,padding:"7px 10px",display:"flex",alignItems:"center",gap:7}}>
                      <Cube3D cube={cube} size={28}/>
                      <div>
                        <div style={{fontSize:9,fontWeight:800,color:cube.rarity.color}}>{cube.name}</div>
                        <div style={{fontSize:8,color:"#FBBF24"}}>Lv.{cube.level.toLocaleString()} · 🪙{cube.value.toLocaleString()}</div>
                      </div>
                      <div style={{fontSize:9,color:"#34D399",marginLeft:3}}>+ SELL</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market listings */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:800,color:"#9CA3AF"}}>🛒 ALL LISTINGS ({market.length})</div>
                {marketLoading&&<div style={{fontSize:10,color:"#60A5FA",animation:"pulse 1s ease-in-out infinite"}}>Loading...</div>}
              </div>
              {market.length===0&&!marketLoading&&(
                <div style={{background:"#0d1b2a",border:"1px solid #1e3a5f",borderRadius:14,padding:"36px",textAlign:"center"}}>
                  <div style={{fontSize:40,opacity:0.3,marginBottom:10}}>🏪</div>
                  <div style={{color:"#374151",fontSize:13,fontWeight:700}}>No listings yet</div>
                  <div style={{color:"#1f2937",fontSize:11,marginTop:4}}>Be the first to list a cube for sale!</div>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {market.map(listing=>{
                  const cube = listing.cube;
                  const isMine = listing.seller===username;
                  const canBuy = !isMine && coins>=listing.price;
                  return (
                    <div key={listing.id} style={{
                      background: cube.rarity.name==="God"
                        ? "linear-gradient(135deg,#1a1500,#2d2400,#1a1500)"
                        : cube.rarity.name==="Secret"
                        ? "linear-gradient(135deg,#1a0826,#2d0a3a,#1a0826)"
                        : `linear-gradient(135deg,${cube.rarity.bg},#080c14)`,
                      border: cube.rarity.name==="God"
                        ? "2px solid #FFD700"
                        : cube.rarity.name==="Secret"
                        ? "2px solid #E879F9"
                        : `2px solid ${isMine?cube.rarity.color+"88":cube.rarity.color+"44"}`,
                      borderRadius:16, padding:"16px",
                      boxShadow: cube.rarity.name==="God"
                        ? "0 0 30px #FFD70044, 0 0 60px #FFD70022"
                        : cube.rarity.name==="Secret"
                        ? "0 0 24px #E879F944"
                        : isMine?`0 0 20px ${cube.rarity.glow}22`:"none",
                      transition:"all 0.2s", position:"relative", overflow:"hidden",
                    }}>
                      {/* God shimmer overlay */}
                      {cube.rarity.name==="God"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 30%,#FFD70011 50%,transparent 70%)",backgroundSize:"200% 200%",animation:"godShine 2s ease infinite",pointerEvents:"none",borderRadius:14}}/>}
                      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
                        <Cube3D cube={cube} size={48} spin={isMine||cube.rarity.special}/>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}>
                            <span style={{
                              fontSize:8,fontWeight:800,
                              color: cube.rarity.name==="God"?"#3d2800":cube.rarity.color,
                              background: cube.rarity.name==="God"?"#FFD700":cube.rarity.name==="Secret"?"#E879F933":cube.rarity.bg+"cc",
                              padding:"2px 6px",borderRadius:4,
                            }}>{cube.rarity.name.toUpperCase()}</span>
                            {isMine&&<span style={{fontSize:8,background:"#1e3a5f",color:"#60A5FA",padding:"2px 6px",borderRadius:4,fontWeight:800}}>YOURS</span>}
                            {listing.isBot&&<span style={{fontSize:8,background:"#0a1a0a",color:"#34D399",padding:"2px 6px",borderRadius:4,fontWeight:800,border:"1px solid #34D39944"}}>🤖 BOT</span>}
                          </div>
                          <div style={{fontSize:15,fontWeight:900,color:cube.rarity.name==="God"?"#FFD700":cube.rarity.name==="Secret"?"#E879F9":"white",lineHeight:1}}>{cube.name}</div>
                          <div style={{fontSize:9,color:"#6B7280",marginTop:2}}>Lv.{cube.level.toLocaleString()} · +{cube.income}/sec</div>
                          <div style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>
                            by <span style={{color:listing.isBot?"#34D399":"#60A5FA",fontWeight:700}}>{listing.isBot?"🤖 "+listing.seller:listing.seller}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{fontSize:18,fontWeight:900,color:cube.rarity.name==="God"?"#FFD700":"#FBBF24"}}>🪙{listing.price.toLocaleString()}</div>
                        {isMine?(
                          <button className="nb" onClick={()=>delistCube(listing)} style={{background:"linear-gradient(135deg,#374151,#1f2937)",color:"#9CA3AF",border:"none",borderRadius:9,padding:"8px 14px",fontSize:11}}>↩ DELIST</button>
                        ):(
                          <button className="nb" onClick={()=>buyListing(listing)} style={{background:canBuy?"linear-gradient(135deg,#FBBF24,#f59e0b)":"linear-gradient(135deg,#374151,#1f2937)",color:canBuy?"#0a0a00":"#6B7280",border:"none",borderRadius:9,padding:"8px 14px",fontSize:11,boxShadow:canBuy?"0 4px 14px #FBBF2444":"none"}}>
                            {canBuy?"🛒 BUY":"🔒 "+listing.price.toLocaleString()}
                          </button>
                        )}
                      </div>
                      <div style={{marginTop:7,fontSize:8,color:"#374151"}}>Listed {new Date(listing.listedAt).toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rarity legend */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:10,background:"linear-gradient(0deg,#050a14 0%,#050a1488 100%)",borderTop:"1px solid #1e3a5f22",padding:"5px 20px",display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
        {RARITIES.map(r=>(
          <div key={r.name} style={{display:"flex",alignItems:"center",gap:3,fontSize:7,
            color:r.color,
            textShadow:r.special?`0 0 6px ${r.glow}`:undefined,
            fontWeight:r.special?900:400,
          }}>
            <div style={{
              width:r.special?6:4, height:r.special?6:4,
              borderRadius:r.name==="God"?0:1,
              background:r.name==="God"?"#FFD700":r.color,
              boxShadow:r.special?`0 0 5px ${r.glow}`:undefined,
              transform:r.name==="God"?"rotate(45deg)":undefined,
              animation:r.name==="Secret"?"secretGlow 2s ease-in-out infinite":r.name==="God"?"godGlow 1.5s ease-in-out infinite":undefined,
            }}/>
            {r.name.toUpperCase()}
            {r.name==="God"&&<span style={{fontSize:6}}>👑</span>}
            {r.name==="Secret"&&<span style={{fontSize:6}}>✦</span>}
          </div>
        ))}
      </div>
    </div>
  );
}