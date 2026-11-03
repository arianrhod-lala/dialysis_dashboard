'use strict';
const chartInstances = {};
let sourceProfiles = Object.freeze([]);
let visibleProfiles = [];
let currentPage = 1;
const rowsPerPage = 10;
const $ = id => document.getElementById(id);
const number = value => value == null || String(value).trim() === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const format = value => value === null ? 'Unavailable' : value.toLocaleString(undefined, {maximumFractionDigits: 2});
function parseCSV(text) {
    const rows = []; let row = [], cell = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') { quoted = false; closed = true; }
            else cell += c;
        } else if (c === '"') {
            if (cell || closed) throw new Error('Invalid CSV quoting.');
            quoted = true;
        } else if (c === ',' || c === '\n' || c === '\r') {
            row.push(cell); cell = ''; closed = false;
            if (c !== ',') { if (row.some(v => v !== '')) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
        } else { if (closed) throw new Error('Invalid text after CSV quote.'); cell += c; }
    }
    if (quoted) throw new Error('Unclosed CSV quote.');
    row.push(cell); if (row.some(v => v !== '')) rows.push(row);
    if (!rows.length) throw new Error('CSV is empty.');
    const headers = rows.shift();
    const required = ['Proxy_ID','SBP_mean','SBP_std','Interdialytic_Weight_Gain_mean','Interdialytic_Weight_Gain_std','Session_Count','Frequency_Category','IDWG_CV','BP_Instability_Rank','Clinical_Risk_Score'];
    if (new Set(headers).size !== headers.length || required.some(h => !headers.includes(h))) throw new Error('CSV schema does not match the dashboard export.');
    return rows.map(values => {
        if (values.length !== headers.length) throw new Error('CSV row has an unexpected number of fields.');
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });
}
function toProfile(row) {
    const sessions = number(row.Session_Count), sbp = number(row.SBP_mean), std = number(row.SBP_std);
    const mean = number(row.Interdialytic_Weight_Gain_mean), weightStd = number(row.Interdialytic_Weight_Gain_std);
    const cv = number(row.IDWG_CV), rank = number(row.BP_Instability_Rank), rawScore = number(row.Clinical_Risk_Score);
    if (!row.Proxy_ID || !Number.isInteger(sessions) || sessions < 1 || !['Low','Medium','High'].includes(row.Frequency_Category)) throw new Error('Invalid profile identity, session count, or exported group.');
    const eligible = sessions >= 2 && sbp !== null && sbp > 0 && std !== null && std >= 0 && mean !== null && mean >= .5 && weightStd !== null && weightStd >= 0 && cv !== null && cv >= 0 && cv <= 2 && Number.isInteger(rank) && rank >= 1 && rank <= 4 && rawScore !== null && rawScore >= 0 && rawScore <= 65;
    const score = eligible ? rawScore : null;
    return Object.freeze({id:row.Proxy_ID,sessions,sbp:sbp > 0 ? sbp : null,cv:mean >= .5 && weightStd !== null && weightStd >= 0 && cv !== null && cv >= 0 && cv <= 2 ? cv * 100 : null,rank:sessions >= 2 && std !== null && std >= 0 && Number.isInteger(rank) && rank >= 1 && rank <= 4 ? rank : null,group:row.Frequency_Category,score,band:score === null ? 'unknown' : score >= 30 ? 'high' : score >= 15 ? 'medium' : 'low'});
}
function filterProfiles(profiles, risk, group, search) {
    return profiles.filter(p => (!risk || p.band === risk) && (!group || p.group === group) && p.id.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b) => (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id));
}
const bandLabel = band => ({high:'High',medium:'Medium',low:'Low',unknown:'Insufficient data'})[band];
function element(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
async function loadData() {
    $('retryBtn').hidden = true; $('loadStatus').textContent = 'Loading Patient_Dashboard_Data.csv…';
    try {
        const response = await fetch('Patient_Dashboard_Data.csv');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const profiles = parseCSV(await response.text()).map(toProfile);
        sourceProfiles = Object.freeze(profiles); applyFilters();
        $('loadStatus').textContent = profiles.length ? 'Aggregate export loaded. Generation date unavailable.' : 'The export contains no profiles.';
    } catch (error) {
        sourceProfiles = Object.freeze([]); applyFilters();
        $('loadStatus').textContent = `Could not load Patient_Dashboard_Data.csv: ${error.message} Serve this folder over HTTP and check the export.`;
        $('retryBtn').hidden = false;
    }
}
function applyFilters() {
    visibleProfiles = filterProfiles(sourceProfiles, $('riskFilter').value, $('frequencyFilter').value, $('searchInput').value);
    currentPage = 1; renderSummary(); displayPage(); updateCharts();
    $('downloadBtn').disabled = !visibleProfiles.length;
}
function renderSummary() {
    const eligible = visibleProfiles.filter(p => p.score !== null).length;
    const metrics = [['Proxy profiles',visibleProfiles.length,`of ${sourceProfiles.length} loaded profiles`],['Recorded sessions',visibleProfiles.reduce((n,p)=>n+p.sessions,0),'Observation count; no time denominator'],['Score eligible',eligible,'Aggregate evidence screen only'],['Insufficient data',visibleProfiles.length-eligible,'Numerical score withheld']];
    $('metricsGrid').replaceChildren(...metrics.map(([label,value,detail])=>{ const el=element('div','','metric'); el.append(element('div',label,'metric-label'),element('div',format(value),'metric-value'),element('div',detail,'metric-detail')); return el; }));
    $('matchCount').textContent = `${visibleProfiles.length} matching profiles · ${sourceProfiles.length} loaded · sorted by score, highest first`;
}
function displayPage() {
    const start = (currentPage-1)*rowsPerPage;
    const rows = visibleProfiles.slice(start,start+rowsPerPage).map(p=>{ const row=element('tr',''); [p.id,format(p.score),bandLabel(p.band),format(p.sbp),format(p.cv),format(p.sessions),p.group,format(p.rank)].forEach((value,i)=>{ const cell=element('td',i===2 ? '' : value); if(i===2) cell.append(element('span',value,`badge ${p.band}`)); row.append(cell); }); return row; });
    if (!rows.length) { const row=element('tr',''); const cell=element('td','No matching profiles. Clear the filters or check the data loading status.'); cell.colSpan=8; row.append(cell); rows.push(row); }
    $('tableBody').replaceChildren(...rows);
    const pages = Math.max(1,Math.ceil(visibleProfiles.length/rowsPerPage));
    $('pageInfo').textContent = visibleProfiles.length ? `${start+1}–${Math.min(start+rowsPerPage,visibleProfiles.length)} of ${visibleProfiles.length} · Page ${currentPage} of ${pages}` : '0 profiles';
    $('prevBtn').disabled = currentPage<=1; $('nextBtn').disabled = currentPage>=pages;
}
function scatterData(profiles) { return ['Low','Medium','High'].map((group,i)=>({label:`${group} session group`,data:profiles.filter(p=>p.group===group && p.score!==null).map(p=>({x:p.sessions,y:p.score})),backgroundColor:['#176b73','#b58128','#6278a0'][i],pointStyle:['circle','triangle','rect'][i],pointRadius:3})); }
function updateCharts() {
    const counts = ['low','medium','high','unknown'].map(b=>visibleProfiles.filter(p=>p.band===b).length);
    $('distributionSummary').textContent = `Low (<15): ${counts[0]} · Medium (15–<30): ${counts[1]} · High (≥30): ${counts[2]} · Insufficient data: ${counts[3]}.`;
    $('scatterSummary').textContent = `${visibleProfiles.filter(p=>p.score!==null).length} eligible profiles plotted; overlapping observations may share coordinates. Association does not establish causation.`;
    try {
        if (typeof Chart === 'undefined') throw new Error('Chart.js unavailable');
        makeChart('sessionsChart','scatter',{datasets:scatterData(visibleProfiles)},'Observed session count','Exploratory score');
        makeChart('distributionChart','bar',{labels:['Low','Medium','High','Insufficient'],datasets:[{label:'Profiles',data:counts,backgroundColor:['#176b73','#b58128','#a54b4b','#87949e']}]},'Score band / evidence','Proxy profiles');
        $('chartStatus').textContent = '';
    } catch (_) { $('chartStatus').textContent = 'Charts are unavailable. Text summaries, filters, the table, and CSV export remain available. Reload to retry the chart dependency.'; }
}
function makeChart(id,type,data,x,y) {
    if(chartInstances[id]) { chartInstances[id].data=data; chartInstances[id].update('none'); return; }
    chartInstances[id]=new Chart($(id),{type,data,options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:type==='scatter',position:'bottom',labels:{usePointStyle:true,color:'#52616b'}}},scales:{x:{...(type==='scatter'?{type:'linear'}:{}),title:{display:true,text:x},grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:y},grid:{color:'#edf0f2'}}}}});
}
function csvCell(value) {
    if (value === null) return '""';
    let text = String(value);
    // Prefix formula-like text for spreadsheet safety; numeric values remain numeric.
    if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) text = "'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
}
function exportCSV(profiles) {
    return [['Proxy profile ID','Exploratory score','Score band','Mean SBP (mmHg)','IDWG CV (%)','Observed sessions','Session group','BP variability rank'],...profiles.map(p=>[p.id,p.score,bandLabel(p.band),p.sbp,p.cv,p.sessions,p.group,p.rank])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
function initialize() {
    ['riskFilter','frequencyFilter'].forEach(id=>$(id).addEventListener('change',applyFilters));
    $('searchInput').addEventListener('input',applyFilters);
    $('resetBtn').addEventListener('click',()=>{ ['riskFilter','frequencyFilter','searchInput'].forEach(id=>$(id).value=''); applyFilters(); });
    $('retryBtn').addEventListener('click',loadData);
    $('prevBtn').addEventListener('click',()=>{if(currentPage>1){currentPage--;displayPage();}});
    $('nextBtn').addEventListener('click',()=>{if(currentPage*rowsPerPage<visibleProfiles.length){currentPage++;displayPage();}});
    $('downloadBtn').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([exportCSV(visibleProfiles)],{type:'text/csv;charset=utf-8'})); const a=element('a',''); a.href=url;a.download='filtered_proxy_profiles.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    loadData();
}
if(typeof document!=='undefined') { if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize,{once:true}); else initialize(); }
if(typeof module!=='undefined') module.exports={parseCSV,toProfile,filterProfiles,scatterData,exportCSV,csvCell};
