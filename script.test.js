'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {parseCSV,toProfile,filterProfiles,scatterData,exportCSV,csvCell} = require('./script.js');
const text = fs.readFileSync(__dirname+'/Patient_Dashboard_Data.csv','utf8');
const raw = parseCSV(text), profiles = raw.map(toProfile);
assert.equal(profiles.length,838);
raw.forEach((row,i)=>{
    assert.equal(profiles[i].id,row.Proxy_ID);
    assert.equal(profiles[i].group,row.Frequency_Category);
    if(profiles[i].score!==null) assert.equal(profiles[i].score,Number(row.Clinical_Risk_Score));
});
const base = raw.find(r=>toProfile(r).score!==null);
for(const changes of [{Session_Count:'1'},{SBP_mean:''},{SBP_std:'NaN'},{IDWG_CV:'bad'},{Clinical_Risk_Score:''},{Interdialytic_Weight_Gain_mean:'0'},{Interdialytic_Weight_Gain_mean:'-1'},{Interdialytic_Weight_Gain_mean:'.2'}]) assert.equal(toProfile({...base,...changes}).score,null);
assert.equal(toProfile({...base,Clinical_Risk_Score:'0'}).score,0);
assert.equal(toProfile({...base,BP_Instability_Rank:'1.5'}).rank,null);
assert.equal(toProfile({...base,BP_Instability_Rank:'1.5'}).score,null);
const high = filterProfiles(profiles,'high','','');
const medium = filterProfiles(profiles,'medium','','');
assert(high.length>0 && medium.length>0);
assert.equal(filterProfiles(profiles,'','','').length,838);
const match=high[0];
assert(filterProfiles(profiles,'high',match.group,match.id).some(p=>p.id===match.id));
assert.equal(filterProfiles(profiles,'medium',match.group,match.id).length,0);
assert.equal(filterProfiles(profiles,'','','no-such-profile').length,0);
assert.deepEqual(profiles.map(p=>p.id),raw.map(r=>r.Proxy_ID));
const normalize = data => data.map(d=>({...d,data:d.data.sort((a,b)=>a.x-b.x||a.y-b.y)}));
assert.deepEqual(normalize(scatterData(profiles)),normalize(scatterData([...profiles].reverse())));
const header=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0];
const quoted={...base,Proxy_ID:'quoted, "ID"\nsecond line'};
const serialize=row=>Object.values(row).map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',');
assert.equal(parseCSV(header+'\r\n'+serialize(quoted))[0].Proxy_ID,quoted.Proxy_ID);
assert.deepEqual(parseCSV(header+'\n'),[]);
for(const invalid of ['', '<html>error</html>',header+'\nx,y',header+'\n"unclosed']) assert.throws(()=>parseCSV(invalid));
assert.equal(csvCell('=1+1'),'"\'=1+1"');
assert.equal(csvCell('  @SUM(1)'),'"\'  @SUM(1)"');
assert.equal(csvCell(-1),'"-1"');
assert.equal(csvCell('a"b'),'"a""b"');
assert.equal(exportCSV(medium).split('\r\n').length,medium.length+1);
assert(exportCSV([toProfile({...base,SBP_mean:''})]).includes('"Insufficient data"'));
console.log(`PASS: ${profiles.length} profiles; ${profiles.filter(p=>p.score===null).length} withheld scores. Schema, quoted CSV, categories, precision, missing evidence, composed filters, immutable input, scatter coordinates, and safe exports verified.`);

// Exercise the actual browser initialization and events without a chart dependency.
const vm = require('node:vm');
class FakeElement {
    constructor() { this.value=''; this.children=[]; this.listeners={}; this.disabled=false; this.hidden=false; this.textContent=''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children=nodes; }
    addEventListener(name,fn) { (this.listeners[name]??=[]).push(fn); }
    fire(name) { return Promise.all((this.listeners[name]??[]).map(fn=>fn())); }
    remove() {}
    click() {}
}
async function browserChecks() {
    const nodes = new Map();
    const get = id => { if(!nodes.has(id)) nodes.set(id,new FakeElement()); return nodes.get(id); };
    let mode='ok',requests=0;
    const context = {
        document:{readyState:'complete',getElementById:get,createElement:()=>new FakeElement(),body:new FakeElement()},
        fetch:async()=>{ requests++; return {ok:mode!=='http',status:503,text:async()=>mode==='html'?'<html>Error</html>':mode==='empty'?header+'\n':text}; },
        console, setTimeout, Blob, URL
    };
    vm.runInNewContext(fs.readFileSync(__dirname+'/script.js','utf8'),context);
    const settle=()=>new Promise(resolve=>setImmediate(resolve));
    await settle();
    assert.match(get('loadStatus').textContent,/loaded/);
    assert.match(get('chartStatus').textContent,/Charts are unavailable/);
    assert.equal(get('tableBody').children.length,10);
    get('riskFilter').value='high'; await get('riskFilter').fire('change');
    assert.match(get('matchCount').textContent,new RegExp('^'+high.length+' matching'));
    get('riskFilter').value='medium'; await get('riskFilter').fire('change');
    assert.match(get('matchCount').textContent,new RegExp('^'+medium.length+' matching'));
    get('searchInput').value='no-such-profile'; await get('searchInput').fire('input');
    assert.equal(get('nextBtn').disabled,true); assert.equal(get('downloadBtn').disabled,true);
    for(let i=0;i<3;i++) await get('resetBtn').fire('click');
    assert.equal(requests,1); assert.equal(get('searchInput').value,'');
    assert.equal(get('riskFilter').listeners.change.length,1);
    await get('nextBtn').fire('click'); assert.match(get('pageInfo').textContent,/Page 2/);
    await get('prevBtn').fire('click'); assert.match(get('pageInfo').textContent,/Page 1/);
    for(const failure of ['http','html']) {
        mode=failure; await get('retryBtn').fire('click');
        assert.match(get('loadStatus').textContent,/Could not load/); assert.equal(get('retryBtn').hidden,false);
        assert.equal(get('downloadBtn').disabled,true);
    }
    mode='empty'; await get('retryBtn').fire('click');
    assert.match(get('loadStatus').textContent,/no profiles/); assert.equal(get('nextBtn').disabled,true);
    mode='ok'; await get('retryBtn').fire('click');
    assert.match(get('loadStatus').textContent,/loaded/); assert.equal(get('retryBtn').hidden,true);
    console.log('PASS: browser event harness verifies HTTP/schema failure, empty export, missing Chart.js, retry, combined filters, local repeated reset, listener count, pagination, and export availability.');
}
browserChecks().catch(error=>{console.error(error);process.exitCode=1;});
