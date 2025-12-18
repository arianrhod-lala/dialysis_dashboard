const chartInstances = {};
let allPatients = [];
let currentPage = 1;
const rowsPerPage = 10;

async function loadData() {
    try {
        // Load the pre-aggregated patient dashboard data (exported from Python analysis)
        const response = await fetch('Patient_Dashboard_Data.csv');
        const csvText = await response.text();
        
        // Simple CSV parser
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, i) => {
                row[header] = values[i];
            });
            return row;
        });

        console.log("CSV available: true");
        console.log("Loaded rows:", data.length);

        // Direct parsing from aggregated data (already processed by analysis_pipeline.py)
        const patientArray = data.map((row, idx) => {
            // First column is usually the index; actual Proxy_ID starts from column 1
            const keys = Object.keys(row);
            const patientId = row[keys[0]];  // Use first column (Proxy_ID index from CSV)
            
            if (!patientId) return null;

            const avgSBP = parseFloat(row['SBP_mean']) || 0;
            const sbpStd = parseFloat(row['SBP_std']) || 0;
            const sbpCV = (sbpStd / avgSBP) * 100 || 0;

            const idwgCV = parseFloat(row['IDWG_CV']) || 0;
            const sessionCount = parseInt(row['Session_Count']) || 0;
            const riskScore = parseFloat(row['Clinical_Risk_Score']) || 0;

            return {
                id: patientId,
                sessionCount: sessionCount,
                avgSBP: avgSBP.toFixed(2),
                sbpCV: sbpCV.toFixed(2),
                idwgCV: idwgCV.toFixed(2),
                riskScore: riskScore.toFixed(2),
                bpInstabilityRank: getBPInstabilityRank(sbpCV),
                dialysisFrequency: getDialysisFrequency(sessionCount),
                hypotensionRisk: (parseFloat(row['Hypotension_Flag']) * 100 || 0).toFixed(2)
            };
        }).filter(p => p !== null);

        console.log("Patients processed:", patientArray.length);
        allPatients = patientArray;
        updateMetrics(patientArray);
        updateCharts(patientArray);
        updateTable(patientArray);
        attachEventListeners(patientArray);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading dataset. Ensure dataset.xlsx is in the same directory.');
    }
}

function getBPInstabilityRank(cv) {
    if (cv >= 20) return 'Very High';
    if (cv >= 15) return 'High';
    if (cv >= 10) return 'Medium';
    return 'Low';
}

function getDialysisFrequency(sessions) {
    if (sessions > 19) return 'High';
    if (sessions >= 3) return 'Medium';
    return 'Low';
}

function updateMetrics(patients) {
    const totalPatients = patients.length;
    const highRisk = patients.filter(p => p.riskScore >= 30).length;
    const mediumRisk = patients.filter(p => p.riskScore >= 15 && p.riskScore < 30).length;
    const lowRisk = patients.filter(p => p.riskScore < 15).length;
    const totalSessions = patients.reduce((sum, p) => sum + p.sessionCount, 0);
    const avgSBP = (patients.reduce((sum, p) => sum + parseFloat(p.avgSBP), 0) / totalPatients).toFixed(2);
    const avgIDWGCV = (patients.reduce((sum, p) => sum + parseFloat(p.idwgCV), 0) / totalPatients).toFixed(2);
    const avgRiskScore = (patients.reduce((sum, p) => sum + parseFloat(p.riskScore), 0) / totalPatients).toFixed(2);

    const metricsData = [
        { label: 'Total Patients', value: totalPatients, detail: 'Clinical dataset' },
        { label: 'High Risk', value: highRisk, detail: `${((highRisk / totalPatients) * 100).toFixed(1)}% of total` },
        { label: 'Medium Risk', value: mediumRisk, detail: `${((mediumRisk / totalPatients) * 100).toFixed(1)}% of total` },
        { label: 'Low Risk', value: lowRisk, detail: `${((lowRisk / totalPatients) * 100).toFixed(1)}% of total` },
        { label: 'Total Sessions', value: totalSessions, detail: 'All dialysis sessions' },
        { label: 'Avg Risk Score', value: avgRiskScore, detail: 'Mean across all patients' },
        { label: 'Avg Systolic BP', value: avgSBP, detail: 'mmHg' },
        { label: 'Avg Weight CV', value: avgIDWGCV, detail: '%' }
    ];

    const grid = document.getElementById('metricsGrid');
    grid.innerHTML = metricsData.map(m => `
        <div class="metric-card">
            <div class="metric-label">${m.label}</div>
            <div class="metric-value">${m.value}</div>
            <div class="metric-detail">${m.detail}</div>
        </div>
    `).join('');
}

function updateCharts(patients) {
    // Chart 1: Patient Risk Stratification (Grouped Histogram)
    const riskBins = { '5-10': 0, '10-15': 0, '15-20': 0, '20-25': 0, '25-30': 0, '30-35': 0, '35-40': 0, '40+': 0 };
    patients.forEach(p => {
        const risk = parseFloat(p.riskScore);
        if (risk < 10) riskBins['5-10']++;
        else if (risk < 15) riskBins['10-15']++;
        else if (risk < 20) riskBins['15-20']++;
        else if (risk < 25) riskBins['20-25']++;
        else if (risk < 30) riskBins['25-30']++;
        else if (risk < 35) riskBins['30-35']++;
        else if (risk < 40) riskBins['35-40']++;
        else riskBins['40+']++;
    });

    const riskLabels = Object.keys(riskBins);
    const riskData = Object.values(riskBins);

    createChart('riskDistributionChart', 'bar', {
        labels: riskLabels,
        datasets: [{
            label: 'Number of Patients',
            data: riskData,
            backgroundColor: riskLabels.map(r => {
                const risk = parseFloat(r);
                if (risk >= 30) return '#dc2626';
                if (risk >= 15) return '#f97316';
                return '#22c55e';
            }),
            borderColor: '#000',
            borderWidth: 1
        }]
    }, { axisLabels: { xLabel: 'Clinical Risk Score', yLabel: 'Number of Patients' } });

    // Chart 2: Risk Map (Scatter: SBP vs IDWG_CV)
    const riskMapData = patients.map(p => ({
        x: parseFloat(p.avgSBP),
        y: parseFloat(p.idwgCV),
        r: (parseFloat(p.riskScore) / 5),
        risk: parseFloat(p.riskScore)
    }));

    createChart('riskMapChart', 'bubble', {
        datasets: [{
            label: 'Low Risk (<15)',
            data: riskMapData.filter(d => d.risk < 15),
            backgroundColor: 'rgba(34, 197, 94, 0.6)',
            borderColor: '#22c55e',
            borderWidth: 1
        },
        {
            label: 'Medium Risk (15-30)',
            data: riskMapData.filter(d => d.risk >= 15 && d.risk < 30),
            backgroundColor: 'rgba(249, 115, 22, 0.6)',
            borderColor: '#f97316',
            borderWidth: 1
        },
        {
            label: 'High Risk (≥30)',
            data: riskMapData.filter(d => d.risk >= 30),
            backgroundColor: 'rgba(220, 38, 38, 0.6)',
            borderColor: '#dc2626',
            borderWidth: 1
        }]
    }, { axisLabels: { xLabel: 'Average Systolic BP (mmHg)', yLabel: 'Weight Gain Volatility (CV %)' } });

    // Chart 3: Dialysis Frequency Distribution (Bar)
    const frequencyCounts = { Low: 0, Medium: 0, High: 0 };
    patients.forEach(p => frequencyCounts[p.dialysisFrequency]++);

    const frequencyColors = { Low: '#06b6d4', Medium: '#f97316', High: '#3b82f6' };

    createChart('frequencyChart', 'bar', {
        labels: Object.keys(frequencyCounts),
        datasets: [{
            label: 'Number of Patients',
            data: Object.values(frequencyCounts),
            backgroundColor: Object.keys(frequencyCounts).map(k => frequencyColors[k]),
            borderColor: '#000',
            borderWidth: 1
        }]
    }, { axisLabels: { xLabel: 'Dialysis Frequency', yLabel: 'Number of Patients' } });

    // Chart 4: Risk Score Distribution by Dialysis Frequency (Bar Chart)
    const riskByFreqHigh = patients.filter(p => p.dialysisFrequency === 'High').map(p => parseFloat(p.riskScore));
    const riskByFreqMed = patients.filter(p => p.dialysisFrequency === 'Medium').map(p => parseFloat(p.riskScore));
    const riskByFreqLow = patients.filter(p => p.dialysisFrequency === 'Low').map(p => parseFloat(p.riskScore));

    const avgRiskHigh = (riskByFreqHigh.reduce((a, b) => a + b, 0) / riskByFreqHigh.length).toFixed(2);
    const avgRiskMed = (riskByFreqMed.reduce((a, b) => a + b, 0) / riskByFreqMed.length).toFixed(2);
    const avgRiskLow = (riskByFreqLow.reduce((a, b) => a + b, 0) / riskByFreqLow.length).toFixed(2);

    createChart('riskByFrequencyChart', 'bar', {
        labels: ['Low', 'Medium', 'High'],
        datasets: [{
            label: 'Average Risk Score',
            data: [avgRiskLow, avgRiskMed, avgRiskHigh],
            backgroundColor: ['rgba(6, 182, 212, 0.7)', 'rgba(249, 115, 22, 0.7)', 'rgba(59, 130, 246, 0.7)'],
            borderColor: ['#06b6d4', '#f97316', '#3b82f6'],
            borderWidth: 2
        }]
    }, { axisLabels: { xLabel: 'Dialysis Frequency', yLabel: 'Average Risk Score' } });

    // Chart 5: Dialysis Frequency vs Risk Score (Scatter with categories)
    const frequencyVsRiskData = patients.map((p, idx) => ({
        x: idx % 20, // Group for better visualization
        y: parseFloat(p.riskScore),
        freq: p.dialysisFrequency,
        sessions: p.sessionCount
    }));

    const freqGroups = { Low: [], Medium: [], High: [] };

    patients.forEach(p => {
        freqGroups[p.dialysisFrequency].push(parseFloat(p.riskScore));
    });

    createChart('frequencyVsRiskChart', 'scatter', {
        datasets: [
            {
                label: 'Low Frequency',
                data: freqGroups.Low.map((risk, idx) => ({ x: idx, y: risk })),
                backgroundColor: 'rgba(6, 182, 212, 0.6)',
                borderColor: '#06b6d4',
                borderWidth: 1
            },
            {
                label: 'Medium Frequency',
                data: freqGroups.Medium.map((risk, idx) => ({ x: idx, y: risk })),
                backgroundColor: 'rgba(249, 115, 22, 0.6)',
                borderColor: '#f97316',
                borderWidth: 1
            },
            {
                label: 'High Frequency',
                data: freqGroups.High.map((risk, idx) => ({ x: idx, y: risk })),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: '#3b82f6',
                borderWidth: 1
            }
        ]
    }, { axisLabels: { xLabel: 'Patient Index (within frequency group)', yLabel: 'Risk Score' } });

    // Chart 6: Average Risk Score by Dialysis Frequency (Bar with labels)
    const freqCategories = ['Low', 'Medium', 'High'];
    const avgRiskByFreq = freqCategories.map(freq => {
        const filtered = patients.filter(p => p.dialysisFrequency === freq);
        return filtered.length > 0 ? (filtered.reduce((sum, p) => sum + parseFloat(p.riskScore), 0) / filtered.length).toFixed(2) : 0;
    });

    createChart('avgRiskByFreqChart', 'bar', {
        labels: freqCategories,
        datasets: [{
            label: 'Average Risk Score',
            data: avgRiskByFreq,
            backgroundColor: ['#06b6d4', '#f97316', '#3b82f6'],
            borderColor: '#000',
            borderWidth: 1,
            datalabels: avgRiskByFreq
        }]
    }, { axisLabels: { xLabel: 'Dialysis Frequency', yLabel: 'Average Risk Score' } });
}

function createChart(elementId, type, data, options = {}) {
    if (chartInstances[elementId]) {
        chartInstances[elementId].destroy();
    }

    const ctx = document.getElementById(elementId).getContext('2d');
    
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    font: { family: "'Inter', sans-serif", size: 13, weight: 500 },
                    color: '#000',
                    usePointStyle: true,
                    padding: 15
                }
            }
        }
    };

    // Add scales for non-doughnut charts
    if (type !== 'doughnut') {
        const axisConfig = options.axisLabels || {};
        chartOptions.scales = {
            x: { 
                ticks: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#666' }, 
                grid: { color: '#e5e7eb' },
                title: {
                    display: !!axisConfig.xLabel,
                    text: axisConfig.xLabel || '',
                    font: { family: "'Inter', sans-serif", size: 13 },
                    color: '#000',
                    padding: 10
                }
            },
            y: { 
                ticks: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#666' }, 
                grid: { color: '#e5e7eb' },
                title: {
                    display: !!axisConfig.yLabel,
                    text: axisConfig.yLabel || '',
                    font: { family: "'Inter', sans-serif", size: 13 },
                    color: '#000',
                    padding: 10
                }
            }
        };
    }

    chartInstances[elementId] = new Chart(ctx, {
        type: type,
        data: data,
        options: chartOptions
    });
}

function updateTable(patients) {
    allPatients = patients.sort((a, b) => parseFloat(b.riskScore) - parseFloat(a.riskScore));
    currentPage = 1;
    displayPage();
}

function displayPage() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = allPatients.slice(start, end);

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = pageData.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.riskScore}</td>
            <td><span class="risk-badge risk-${(p.riskScore >= 30 ? 'high' : p.riskScore >= 15 ? 'medium' : 'low')}">${p.riskScore >= 30 ? 'High' : p.riskScore >= 15 ? 'Medium' : 'Low'}</span></td>
            <td>${p.avgSBP}</td>
            <td>${p.idwgCV}</td>
            <td>${p.sessionCount}</td>
            <td><span class="freq-badge freq-${p.dialysisFrequency.toLowerCase()}">${p.dialysisFrequency}</span></td>
            <td>${p.bpInstabilityRank}</td>
        </tr>
    `).join('');

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(allPatients.length / rowsPerPage);
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = '';
    paginationDiv.style.display = 'flex';
    paginationDiv.style.gap = '10px';
    paginationDiv.style.justifyContent = 'center';

    // Prev button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.padding = '8px 16px';
    prevBtn.style.border = '1px solid #d1d5db';
    prevBtn.style.borderRadius = '6px';
    prevBtn.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
    prevBtn.style.fontSize = '13px';
    prevBtn.style.background = currentPage === 1 ? '#f3f4f6' : 'white';
    prevBtn.style.color = currentPage === 1 ? '#ccc' : '#000';
    prevBtn.style.transition = 'all 0.2s ease';
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayPage();
            window.scrollTo({ top: document.querySelector('.table-section').offsetTop - 100, behavior: 'smooth' });
        }
    };
    paginationDiv.appendChild(prevBtn);

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.style.padding = '8px 16px';
    nextBtn.style.border = '1px solid #d1d5db';
    nextBtn.style.borderRadius = '6px';
    nextBtn.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer';
    nextBtn.style.fontSize = '13px';
    nextBtn.style.background = currentPage === totalPages ? '#f3f4f6' : 'white';
    nextBtn.style.color = currentPage === totalPages ? '#ccc' : '#000';
    nextBtn.style.transition = 'all 0.2s ease';
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayPage();
            window.scrollTo({ top: document.querySelector('.table-section').offsetTop - 100, behavior: 'smooth' });
        }
    };
    paginationDiv.appendChild(nextBtn);
}

function applyFilters() {
    const riskFilter = document.getElementById('riskFilter').value;
    const frequencyFilter = document.getElementById('frequencyFilter').value;

    let filtered = allPatients.slice();

    if (riskFilter === 'high') filtered = filtered.filter(p => p.riskScore >= 30);
    if (riskFilter === 'medium') filtered = filtered.filter(p => p.riskScore >= 15 && p.riskScore < 30);
    if (riskFilter === 'low') filtered = filtered.filter(p => p.riskScore < 15);

    if (frequencyFilter) filtered = filtered.filter(p => p.dialysisFrequency === frequencyFilter);

    allPatients = filtered;
    currentPage = 1;
    displayPage();
}

function resetFilters() {
    document.getElementById('riskFilter').value = '';
    document.getElementById('frequencyFilter').value = '';
    loadData();
}

function downloadTableAsCSV() {
    const headers = ['Patient ID', 'Risk Score', 'Risk Level', 'Avg SBP', 'IDWG CV', 'Session Count', 'Frequency', 'BP Instability'];
    const rows = [];
    
    allPatients.forEach(p => {
        rows.push([
            p.id,
            p.riskScore,
            (p.riskScore >= 30 ? 'High' : p.riskScore >= 15 ? 'Medium' : 'Low'),
            p.avgSBP,
            p.idwgCV,
            p.sessionCount,
            p.dialysisFrequency,
            p.bpInstabilityRank
        ]);
    });

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'high_risk_patients.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function attachEventListeners(patients) {
    document.getElementById('riskFilter').addEventListener('change', applyFilters);
    document.getElementById('frequencyFilter').addEventListener('change', applyFilters);
    
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadTableAsCSV);
    }

    document.getElementById('searchInput').addEventListener('input', (e) => {
        const searchValue = e.target.value.toLowerCase().trim();
        if (searchValue === '') {
            allPatients = patients.sort((a, b) => parseFloat(b.riskScore) - parseFloat(a.riskScore));
        } else {
            allPatients = patients.filter(p => p.id.toLowerCase().includes(searchValue)).sort((a, b) => parseFloat(b.riskScore) - parseFloat(a.riskScore));
        }
        currentPage = 1;
        displayPage();
    });
}

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
        loadData();
    }, 800);
});
