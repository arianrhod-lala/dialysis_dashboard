# Dialysis Patient Survival Analysis Dashboard

## 🎯 Overview
A comprehensive interactive dashboard for tracking dialysis patient clinical risk and survival analysis based on dialysis frequency and clinical metrics.

## 📁 Files Generated

### Data Files:
1. **dataset.xlsx** - Original clinical data (12,404 sessions, 838 unique patients)
2. **Patient_Dashboard_Data.csv** - Processed patient metrics
3. **High_Risk_Patients_Report.csv** - Critical patients (108 high-risk cases)
4. **Dashboard_Risk_Analysis.png** - 6-panel statistical visualization

### Dashboard Files:
- **dashboard.html** - Main interactive dashboard (all-in-one file)

## 🚀 How to Use

### Option 1: Open Locally
1. Navigate to: `c:\Users\Ian\Documents\pangatlo k nato\`
2. Double-click `dashboard.html` to open in your browser
3. The dashboard will automatically load the `dataset.xlsx` file and display all data

### Option 2: Using a Local Server (Recommended for best performance)
```bash
# Using Python
cd "c:\Users\Ian\Documents\pangatlo k nato"
python -m http.server 8000

# Then open: http://localhost:8000/dashboard.html
```

## ✨ Dashboard Features

### 1. **Loading Animation**
   - Unique logo animation with pulsing circles
   - Smooth fade-out transition when data loads
   - Professional branding with gradient colors

### 2. **Real-Time Metrics**
   - Total patients analyzed
   - Risk distribution (High/Medium/Low)
   - Average risk scores
   - Session counts and blood pressure metrics
   - Hypotension case tracking

### 3. **Interactive Visualizations (6 Charts)**
   - Risk Distribution (Bar chart)
   - Dialysis Frequency Distribution (Doughnut chart)
   - Risk vs. Dialysis Frequency (Line chart)
   - BP Instability Rankings (Bar chart)
   - Systolic BP Distribution (Bar chart)
   - Weight Gain Volatility (Area chart)

### 4. **Advanced Filtering & Search**
   - **Risk Level Filter**: High, Medium, Low
   - **Dialysis Frequency Filter**: High (>19), Medium (3-19), Low (<3)
   - **Patient Search**: Search by patient ID
   - **Reset Button**: Clear all filters instantly

### 5. **Patient Data Table**
   - Sortable patient records
   - Risk badges with color coding
   - Frequency category indicators
   - BP instability rankings
   - Pagination (10 patients per page)

### 6. **Design Features**
   - Clean white background (Notion-style)
   - Smooth animations and transitions
   - Responsive layout (works on mobile)
   - Color-coded risk levels
   - Professional typography

## 📊 Dashboard Metrics Displayed

### Summary Statistics:
- **Total Patients**: 838
- **High Risk (≥30)**: 108 patients (12.9%)
- **Medium Risk (15-29)**: 442 patients (52.7%)
- **Low Risk (<15)**: 288 patients (34.4%)
- **Average Risk Score**: 19.04
- **Average Dialysis Sessions**: 14.8 per patient

### Clinical Metrics:
- **Average Systolic BP**: 131.4 mmHg
- **Average Diastolic BP**: 61.9 mmHg
- **Hypotension Cases**: 87 patients (<100 mmHg)
- **Weight Gain Volatility (CV)**: 0.394 ± 0.364

### Key Correlation:
- **Dialysis Frequency ↔ Risk Score**: 0.270 (positive correlation)

## 🎨 Color Scheme

| Element | Color |
|---------|-------|
| Primary | #2563eb (Blue) |
| Accent | #7c3aed (Purple) |
| Background | #ffffff (White) |
| High Risk | #fee2e2 (Light Red) |
| Medium Risk | #fef3c7 (Light Yellow) |
| Low Risk | #dcfce7 (Light Green) |

## 💻 Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Charts**: Chart.js 3.9.1
- **Data**: XLSX.js (reads Excel files directly)
- **Responsive**: Mobile-friendly design
- **Performance**: Optimized for large datasets

## 🔄 Data Processing Pipeline

1. **Python Analysis** (`analysis_pipeline.py`)
   - Loads 12,404 clinical sessions
   - Aggregates to 838 unique patients
   - Calculates risk scores (0-55 scale)
   - Determines dialysis frequency categories
   - Generates visualizations

2. **Dashboard** (`dashboard.html`)
   - Reads Excel data on browser
   - Processes patient metrics client-side
   - Renders interactive charts
   - Enables real-time filtering

## 📈 Risk Score Calculation

```
Clinical_Risk_Score = (Hypotension_Flag × 25) + (BP_Instability_Rank × 5) + (IDWG_CV × 10)

Where:
- Hypotension_Flag: 1 if SBP < 100 mmHg, else 0
- BP_Instability_Rank: 1-4 (quartile of SBP standard deviation)
- IDWG_CV: Weight gain volatility (capped at 2.0)

Range: 5.0 - 50.4 points
```

## 🔍 Filtering & Search Examples

**Search Patient**: Type patient ID in search bar
**Filter High Risk**: Select "High Risk (≥30)" from dropdown
**Filter by Frequency**: Select dialysis frequency category
**Combine Filters**: Use multiple filters simultaneously

## 📱 Browser Compatibility

- ✅ Chrome (Latest)
- ✅ Firefox (Latest)
- ✅ Safari (Latest)
- ✅ Edge (Latest)
- ✅ Mobile browsers

## 🎯 Use Cases

1. **Clinical Triage**: Identify high-risk patients for intervention
2. **Resource Allocation**: Prioritize patients by risk level
3. **Frequency Analysis**: Correlate dialysis frequency with clinical outcomes
4. **Monitoring**: Track patient population trends
5. **Research**: Generate insights on CD patient survivability

## 📞 Support

For data updates or modifications:
1. Update `dataset.xlsx` with new clinical records
2. Refresh browser to reload data automatically
3. Dashboard will recalculate all metrics in real-time

## 📄 License

Clinical Data Analysis Dashboard © 2025

---

**Created**: December 18, 2025
**Dashboard Version**: 1.0
**Data Points**: 12,404 sessions from 838 patients
