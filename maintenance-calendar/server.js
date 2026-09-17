import express from "express";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 10000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

app.use(express.json({ limit: "100kb" }));

async function initialize() {
  await pool.query(\`
    CREATE SCHEMA IF NOT EXISTS pm_calendar;
    CREATE TABLE IF NOT EXISTS pm_calendar.schedules (
      id BIGSERIAL PRIMARY KEY,
      equipment_name TEXT NOT NULL,
      asset_number TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      task TEXT NOT NULL,
      frequency_days INTEGER NOT NULL CHECK (frequency_days BETWEEN 1 AND 3650),
      last_completed DATE,
      next_due DATE NOT NULL,
      assigned_to TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pm_calendar_next_due
      ON pm_calendar.schedules(next_due);
    CREATE TABLE IF NOT EXISTS pm_calendar.history (
      id BIGSERIAL PRIMARY KEY,
      schedule_id BIGINT NOT NULL REFERENCES pm_calendar.schedules(id),
      completed_at DATE NOT NULL,
      previous_due DATE NOT NULL,
      next_due DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  \`);
}

function text(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/pm", async (_req, res) => {
  try {
    const result = await pool.query(\`
      SELECT id, equipment_name AS "equipmentName", asset_number AS "assetNumber",
        location, task, frequency_days AS "frequencyDays",
        TO_CHAR(last_completed, 'YYYY-MM-DD') AS "lastCompleted",
        TO_CHAR(next_due, 'YYYY-MM-DD') AS "nextDue",
        assigned_to AS "assignedTo", notes
      FROM pm_calendar.schedules
      ORDER BY next_due, equipment_name
    \`);
    res.json({ items: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load PM dates." });
  }
});

app.post("/api/pm", async (req, res) => {
  try {
    const equipmentName = text(req.body.equipmentName, 120);
    const task = text(req.body.task, 300);
    const nextDue = text(req.body.nextDue, 10);
    const frequencyDays = Number(req.body.frequencyDays);
    if (!equipmentName || !task || !/^\d{4}-\d{2}-\d{2}$/.test(nextDue)) {
      return res.status(400).json({ error: "Equipment, PM task, and due date are required." });
    }
    if (!Number.isInteger(frequencyDays) || frequencyDays < 1 || frequencyDays > 3650) {
      return res.status(400).json({ error: "Choose a valid repeat schedule." });
    }
    const result = await pool.query(\`
      INSERT INTO pm_calendar.schedules
        (equipment_name, asset_number, location, task, frequency_days, next_due)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    \`, [equipmentName, text(req.body.assetNumber, 80), text(req.body.location, 120), task, frequencyDays, nextDue]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not add the PM date." });
  }
});

app.post("/api/pm/:id/complete", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid PM record." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT id, next_due, frequency_days FROM pm_calendar.schedules WHERE id=$1 FOR UPDATE",
      [id]
    );
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "PM record not found." });
    }
    const completed = new Date();
    const next = new Date(completed);
    next.setUTCDate(next.getUTCDate() + current.rows[0].frequency_days);
    const completedAt = completed.toISOString().slice(0, 10);
    const nextDue = next.toISOString().slice(0, 10);
    await client.query(\`
      INSERT INTO pm_calendar.history (schedule_id, completed_at, previous_due, next_due)
      VALUES ($1, $2, $3, $4)
    \`, [id, completedAt, current.rows[0].next_due, nextDue]);
    await client.query(\`
      UPDATE pm_calendar.schedules
      SET last_completed=$2, next_due=$3, updated_at=NOW()
      WHERE id=$1
    \`, [id, completedAt, nextDue]);
    await client.query("COMMIT");
    res.json({ completedAt, nextDue });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Could not complete the PM." });
  } finally {
    client.release();
  }
});

const html = String.raw\`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PM Calendar</title><meta name="theme-color" content="#102e31">
<style>
:root{--ink:#172428;--teal:#145e62;--dark:#102e31;--gold:#d7aa4b;--line:#d9e0e3;--bg:#f3f5f7}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Avenir Next",Avenir,"Segoe UI",sans-serif}
button,input,select{font:inherit}.top{height:70px;padding:0 clamp(16px,4vw,48px);display:flex;align-items:center;justify-content:space-between;background:var(--dark);color:#fff}
.brand{display:flex;align-items:center;gap:11px;font-weight:750}.mark{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:var(--gold);color:var(--dark);font-size:20px}.add{border:0;border-radius:8px;background:var(--gold);color:var(--dark);padding:10px 15px;font-weight:750;cursor:pointer}
.shell{width:min(1500px,calc(100% - 32px));margin:auto;padding:32px 0 48px}.toolbar{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.kicker{margin:0 0 4px;color:#6a7a80;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}h1{margin:0;font-size:clamp(29px,4vw,43px);line-height:1;letter-spacing:-.04em}.actions{display:flex;gap:7px}.ghost{border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px 12px;cursor:pointer}.legend{display:flex;justify-content:flex-end;gap:16px;margin:0 0 12px;color:#66757b;font-size:12px}.legend span{display:flex;align-items:center;gap:5px}.dot{width:9px;height:9px;border-radius:50%}.red{background:#c3473f}.amber{background:#d69a27}.green{background:#2d8583}
.calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 34px #132a3010}.weekday{padding:11px 12px;background:#edf2f3;border-right:1px solid var(--line);color:#5d6d73;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.weekday:nth-child(7){border-right:0}
.day{min-height:145px;padding:9px;border-top:1px solid var(--line);border-right:1px solid var(--line);background:#fff}.day:nth-child(7n){border-right:0}.day.out{background:#f8fafb;color:#a9b2b6}.day.today{box-shadow:inset 0 0 0 2px #2d7f82}.num{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;font-size:13px;font-weight:700}.today .num{background:var(--teal);color:#fff}.events{display:grid;gap:5px;margin-top:5px}.event{width:100%;padding:6px 7px;display:grid;text-align:left;border:0;border-left:3px solid;border-radius:5px;cursor:pointer;overflow:hidden}.event strong,.event span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.event strong{font-size:11px}.event span{font-size:10px;opacity:.78}.event.overdue{background:#fbe8e6;border-color:#c3473f;color:#8d2e29}.event.soon{background:#fff2d8;border-color:#d69a27;color:#80550c}.event.scheduled{background:#e3f1ef;border-color:#2d8583;color:#205e5c}.more{padding-left:5px;color:#68777d;font-size:11px}
dialog{width:min(520px,calc(100% - 28px));border:0;border-radius:15px;padding:0;box-shadow:0 24px 70px #102e3140}dialog::backdrop{background:#0d252980;backdrop-filter:blur(3px)}.modal{padding:24px}.modal h2{margin:0;font-size:22px}.modal .sub{margin:6px 0 20px;color:#6d7a80;font-size:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:grid;gap:6px}.field label{font-size:13px;font-weight:700}.field small{font-weight:500;color:#7d888d}input,select{width:100%;height:40px;border:1px solid #cfd8db;border-radius:8px;padding:0 10px;background:#fff}.foot{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}.primary{border:0;border-radius:8px;background:var(--teal);color:#fff;padding:10px 14px;font-weight:700;cursor:pointer}.details{display:grid;gap:12px}.details div{display:grid;gap:2px;padding-bottom:10px;border-bottom:1px solid var(--line)}.details span{color:#75838a;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.details strong{font-size:15px}.loading{text-align:center;color:#6c797f;padding:16px}
@media(max-width:760px){.shell{width:calc(100% - 12px);padding-top:20px}.toolbar{align-items:center}.todayBtn{display:none}.legend{justify-content:flex-start;flex-wrap:wrap}.calendar{border-radius:10px}.weekday{padding:8px 2px;text-align:center;font-size:10px}.day{min-height:98px;padding:4px}.num{width:23px;height:23px;font-size:11px}.event{padding:4px}.event strong{font-size:9px}.event span{display:none}.grid{grid-template-columns:1fr}.optional{display:none}}
@media(max-width:430px){.top{height:62px}.shell h1{font-size:25px}.day{min-height:82px}.legend{gap:10px;font-size:11px}}
</style></head><body>
<header class="top"><div class="brand"><span class="mark">🔧</span>PM Calendar</div><button class="add" id="openAdd">＋ Add PM</button></header>
<main class="shell"><div class="toolbar"><div><p class="kicker">Maintenance schedule</p><h1 id="monthTitle"></h1></div><div class="actions"><button class="ghost todayBtn" id="today">Today</button><button class="ghost" id="prev" aria-label="Previous month">‹</button><button class="ghost" id="next" aria-label="Next month">›</button></div></div>
<div class="legend"><span><i class="dot red"></i>Overdue</span><span><i class="dot amber"></i>Due soon</span><span><i class="dot green"></i>Scheduled</span></div>
<div class="calendar" id="calendar"></div><div class="loading" id="loading">Loading calendar…</div></main>
<dialog id="addDialog"><form class="modal" id="addForm"><h2>Add a PM date</h2><p class="sub">Add the equipment, task, and date it is due.</p><div class="grid">
<div class="field"><label>Equipment</label><input name="equipmentName" required placeholder="Press Brake 04"></div>
<div class="field"><label>PM task</label><input name="task" required placeholder="Inspect and lubricate"></div>
<div class="field"><label>Due date</label><input name="nextDue" type="date" required></div>
<div class="field"><label>Repeat</label><select name="frequencyDays"><option value="7">Weekly</option><option value="30" selected>Monthly</option><option value="90">Quarterly</option><option value="180">Every 6 months</option><option value="365">Yearly</option></select></div>
<div class="field optional"><label>Asset number <small>optional</small></label><input name="assetNumber"></div>
<div class="field optional"><label>Location <small>optional</small></label><input name="location"></div></div>
<div class="foot"><button type="button" class="ghost close">Cancel</button><button class="primary">Add to calendar</button></div></form></dialog>
<dialog id="detailDialog"><div class="modal"><h2 id="detailTitle"></h2><p class="sub" id="detailDue"></p><div class="details" id="details"></div><div class="foot"><button class="ghost close">Close</button><button class="primary" id="complete">✓ Mark complete</button></div></div></dialog>
<script>
let items=[], view=new Date(), selected=null;
const cal=document.getElementById("calendar"), loading=document.getElementById("loading"), addDialog=document.getElementById("addDialog"), detailDialog=document.getElementById("detailDialog");
const pad=n=>String(n).padStart(2,"0"), key=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function eventStatus(date){const now=key(new Date()),soon=new Date();soon.setDate(soon.getDate()+14);return date<now?"overdue":date<=key(soon)?"soon":"scheduled"}
function render(){
  const first=new Date(view.getFullYear(),view.getMonth(),1), start=new Date(first);start.setDate(start.getDate()-start.getDay());
  document.getElementById("monthTitle").textContent=view.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  cal.innerHTML=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>'<div class="weekday">'+d+'</div>').join("");
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=key(d), dayItems=items.filter(x=>x.nextDue===k);const cell=document.createElement("div");cell.className="day"+(d.getMonth()!==view.getMonth()?" out":"")+(k===key(new Date())?" today":"");cell.innerHTML='<span class="num">'+d.getDate()+'</span><div class="events">'+dayItems.slice(0,3).map(x=>'<button class="event '+eventStatus(x.nextDue)+'" data-id="'+x.id+'"><strong>'+esc(x.equipmentName)+'</strong><span>'+esc(x.task)+'</span></button>').join("")+(dayItems.length>3?'<small class="more">+'+(dayItems.length-3)+' more</small>':"")+'</div>';cal.appendChild(cell)}
  cal.querySelectorAll(".event").forEach(b=>b.onclick=()=>showDetail(Number(b.dataset.id)));
}
async function load(){const r=await fetch("/api/pm");const d=await r.json();if(!r.ok)throw new Error(d.error);items=d.items||[];loading.hidden=true;render()}
function showDetail(id){selected=items.find(x=>Number(x.id)===id);if(!selected)return;document.getElementById("detailTitle").textContent=selected.equipmentName;document.getElementById("detailDue").textContent="Due "+new Date(selected.nextDue+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});const rows=[["PM task",selected.task],["Asset",selected.assetNumber],["Location",selected.location],["Repeats","Every "+selected.frequencyDays+" days"]].filter(x=>x[1]);document.getElementById("details").innerHTML=rows.map(x=>'<div><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join("");detailDialog.showModal()}
document.getElementById("prev").onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1);render()};document.getElementById("next").onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1);render()};document.getElementById("today").onclick=()=>{view=new Date();render()};document.getElementById("openAdd").onclick=()=>addDialog.showModal();document.querySelectorAll(".close").forEach(b=>b.onclick=()=>b.closest("dialog").close());
document.getElementById("addForm").onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.frequencyDays=Number(body.frequencyDays);const r=await fetch("/api/pm",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)return alert(d.error);e.target.reset();addDialog.close();await load()};
document.getElementById("complete").onclick=async()=>{const r=await fetch("/api/pm/"+selected.id+"/complete",{method:"POST"});const d=await r.json();if(!r.ok)return alert(d.error);detailDialog.close();await load()};
load().catch(e=>{loading.textContent=e.message});
</script></body></html>\`;

app.get("*", (_req, res) => res.type("html").send(html));

initialize()
  .then(() => app.listen(port, "0.0.0.0", () => console.log(\`PM Calendar listening on \${port}\`)))
  .catch((error) => { console.error("Database initialization failed", error); process.exit(1); });
