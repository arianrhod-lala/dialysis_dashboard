import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Loading clinical dataset
clinical_df = pd.read_excel("dataset.xlsx")
print(clinical_df.head())
print(clinical_df.info())

# Cleaning the dataset
clinical_df = clinical_df.dropna(subset=['Age', 'Sex', 'Weight_Dry'])  # Only drop rows missing these essential ID columns

print(f"Clinical data shape after dropna: {clinical_df.shape}")

clinical_df = clinical_df.drop('Column1', axis=1)

# Clinical Data Computations
# 1. Making Proxy IDs
column_mapping = {
    'Systolic_Blood_Pressure': 'SBP',
    'Diastolic_Blood_Pressure': 'DBP'
}
clinical_df.rename(columns=column_mapping, inplace=True)
print("✅ Columns successfully renamed to SBP and DBP.")

# --- DEBUGGING CHECK ---
print(f"Total Rows Loaded: {len(clinical_df)}")
# Check if columns exist (Case Sensitive!)
required_cols = ['Age', 'Sex', 'Weight_Dry', 'SBP', 'Interdialytic_Weight_Gain']
missing_cols = [col for col in required_cols if col not in clinical_df.columns]
if missing_cols:
    print(f"⚠️ CRITICAL ERROR: Missing columns: {missing_cols}")
    print(f"Your available columns are: {list(clinical_df.columns)}")
else:
    print("✅ All columns found.")

# 2. SAFER Proxy ID Creation
# We fill NaNs with 'Unknown' and force everything to string to prevent rows from disappearing
clinical_df['Proxy_ID'] = (
    clinical_df['Age'].fillna('Unknown').astype(str) + "_" + 
    clinical_df['Sex'].fillna('Unknown').astype(str) + "_" + 
    clinical_df['Weight_Dry'].fillna('Unknown').astype(str)
)

# Check if we are still losing data
print(f"Unique Patients Found: {clinical_df['Proxy_ID'].nunique()}")

# 3. Aggregations (Ensure numeric columns are actually numbers)
# Force numeric conversion (coerces non-numbers to NaN) to avoid crashing on typos
cols_to_numeric = ['SBP', 'DBP', 'Interdialytic_Weight_Gain']
for col in cols_to_numeric:
    if col in clinical_df.columns:
        clinical_df[col] = pd.to_numeric(clinical_df[col], errors='coerce')

aggregations = {
    'SBP': ['mean', 'std'],
    'DBP': ['mean', 'std'],
    'Interdialytic_Weight_Gain': ['mean', 'std'], 
    'Proxy_ID': 'size'
}

# 4. Create the Patient Profile DataFrame
patient_risk_df = clinical_df.groupby('Proxy_ID').agg(aggregations)

# Flatten columns
patient_risk_df.columns = [
    '_'.join(col).strip() for col in patient_risk_df.columns.values
]
patient_risk_df.rename(columns={'Proxy_ID_size': 'Session_Count'}, inplace=True)

# Add Dialysis Frequency Analysis
# Dialysis Frequency = sessions per patient (proxy for how often they attend)
patient_risk_df['Dialysis_Frequency'] = patient_risk_df['Session_Count']

# Categorize frequency (Low, Medium, High)
# Low: < 25th percentile, Medium: 25-75th percentile, High: > 75th percentile
freq_q25 = patient_risk_df['Dialysis_Frequency'].quantile(0.25)
freq_q75 = patient_risk_df['Dialysis_Frequency'].quantile(0.75)

patient_risk_df['Frequency_Category'] = pd.cut(
    patient_risk_df['Dialysis_Frequency'],
    bins=[0, freq_q25, freq_q75, float('inf')],
    labels=['Low', 'Medium', 'High']
)

print(f"\n📊 Dialysis Frequency Distribution:")
print(f"   Low (<{freq_q25:.0f} sessions): {(patient_risk_df['Frequency_Category']=='Low').sum()} patients")
print(f"   Medium ({freq_q25:.0f}-{freq_q75:.0f} sessions): {(patient_risk_df['Frequency_Category']=='Medium').sum()} patients")
print(f"   High (>{freq_q75:.0f} sessions): {(patient_risk_df['Frequency_Category']=='High').sum()} patients")

# 5. Calculate Risk Components (With Safety Checks)
# ----------------------------

# A. IDWG Volatility
patient_risk_df['IDWG_CV'] = (
    patient_risk_df['Interdialytic_Weight_Gain_std'] / 
    patient_risk_df['Interdialytic_Weight_Gain_mean']
).fillna(0)

# B. Hypotension
patient_risk_df['Hypotension_Flag'] = np.where(
    patient_risk_df['SBP_mean'] < 100, 1, 0
)

# C. BP Instability
# fillna(0) ensures single-session patients don't break the code
patient_risk_df['BP_Instability_Rank'] = pd.qcut(
    patient_risk_df['SBP_std'].fillna(0), q=4, labels=[1, 2, 3, 4], duplicates='drop'
).astype(int)

# --- REPLACEMENT CODE FOR STEP 6 ---

# 1. Clean IDWG Data before calculation
# If Mean IDWG is less than 0.5kg, it's likely a data error. We treat their CV as 0 (Stable/Unknown).
# We also cap the CV at 2.0 (200% variance) to prevent outliers from ruining the score.

# Calculate raw CV
raw_cv = (
    patient_risk_df['Interdialytic_Weight_Gain_std'] / 
    patient_risk_df['Interdialytic_Weight_Gain_mean']
)

# Apply logical filters
patient_risk_df['IDWG_CV'] = np.where(
    patient_risk_df['Interdialytic_Weight_Gain_mean'] < 0.5, 0, raw_cv # If mean is tiny, set CV to 0
)
patient_risk_df['IDWG_CV'] = patient_risk_df['IDWG_CV'].fillna(0) # Handle NaNs
patient_risk_df['IDWG_CV'] = patient_risk_df['IDWG_CV'].clip(upper=2.0) # Cap at 2.0

# 2. Recalculate Score with Cleaned Data
patient_risk_df['Clinical_Risk_Score'] = (
    (patient_risk_df['Hypotension_Flag'] * 25) +      
    (patient_risk_df['BP_Instability_Rank'] * 5) +    
    (patient_risk_df['IDWG_CV'] * 10)                 
)

# Sort
patient_risk_df = patient_risk_df.sort_values(by='Clinical_Risk_Score', ascending=False)

# Display sanity check
print("\nTop 5 High Risk Patients (CORRECTED):")
print(patient_risk_df[['Session_Count', 'SBP_mean', 'IDWG_CV', 'Clinical_Risk_Score']].head())

# Set the visual style
sns.set_style("whitegrid")

# ==========================================
# DASHBOARD VISUALIZATIONS
# ==========================================

# FIGURE 1: Risk Distribution + Dialysis Frequency Impact
fig = plt.figure(figsize=(18, 10))

# --- CHART 1.1: Risk Distribution (The "Triage" View) ---
plt.subplot(2, 3, 1)
sns.histplot(patient_risk_df['Clinical_Risk_Score'], bins=20, kde=True, color='#c0392b')
plt.axvline(30, color='red', linestyle='--', linewidth=2, label='Critical Threshold (30)')
plt.axvline(15, color='orange', linestyle='--', linewidth=2, label='Warning Threshold (15)')
plt.title('Patient Risk Stratification', fontsize=12, fontweight='bold')
plt.xlabel('Clinical Risk Score (0 - 55)', fontsize=10)
plt.ylabel('Number of Patients', fontsize=10)
plt.legend()

# --- CHART 1.2: Risk Map (Hemodynamics vs. Volatility) ---
plt.subplot(2, 3, 2)
scatter = plt.scatter(
    patient_risk_df['SBP_mean'], 
    patient_risk_df['IDWG_CV'], 
    c=patient_risk_df['Clinical_Risk_Score'], 
    cmap='Reds', 
    edgecolor='k', 
    alpha=0.7,
    s=40
)
plt.axvline(100, color='blue', linestyle='--', label='Hypotension Limit (100 mmHg)')
plt.axhline(0.3, color='green', linestyle=':', label='High Volatility (>0.3)')
plt.colorbar(scatter, label='Risk Score')
plt.title('Risk Map: Hemodynamics vs. Compliance', fontsize=12, fontweight='bold')
plt.xlabel('Average Systolic BP (mmHg)', fontsize=10)
plt.ylabel('Weight Gain Volatility (CV)', fontsize=10)
plt.legend(loc='upper right', fontsize=8)

# --- CHART 1.3: Dialysis Frequency Distribution ---
plt.subplot(2, 3, 3)
freq_counts = patient_risk_df['Frequency_Category'].value_counts()
colors_freq = ['#2ecc71', '#f39c12', '#e74c3c']
plt.bar(freq_counts.index, freq_counts.values, color=colors_freq, edgecolor='black', alpha=0.7)
plt.title('Dialysis Frequency Distribution', fontsize=12, fontweight='bold')
plt.xlabel('Frequency Category', fontsize=10)
plt.ylabel('Number of Patients', fontsize=10)
plt.grid(axis='y', alpha=0.3)

# --- CHART 1.4: Risk Score by Dialysis Frequency ---
plt.subplot(2, 3, 4)
freq_risk = patient_risk_df.groupby('Frequency_Category')['Clinical_Risk_Score'].apply(list)
bp = plt.boxplot([freq_risk['Low'], freq_risk['Medium'], freq_risk['High']], 
                   labels=['Low', 'Medium', 'High'],
                   patch_artist=True)
for patch, color in zip(bp['boxes'], colors_freq):
    patch.set_facecolor(color)
plt.title('Risk Score Distribution by Dialysis Frequency', fontsize=12, fontweight='bold')
plt.xlabel('Dialysis Frequency', fontsize=10)
plt.ylabel('Clinical Risk Score', fontsize=10)
plt.grid(axis='y', alpha=0.3)

# --- CHART 1.5: Frequency vs. Sessions Count ---
plt.subplot(2, 3, 5)
for category, color in zip(['Low', 'Medium', 'High'], colors_freq):
    mask = patient_risk_df['Frequency_Category'] == category
    plt.scatter(patient_risk_df[mask]['Dialysis_Frequency'], 
               patient_risk_df[mask]['Clinical_Risk_Score'],
               label=category, color=color, alpha=0.6, s=50)
plt.title('Dialysis Frequency vs. Risk Score', fontsize=12, fontweight='bold')
plt.xlabel('Number of Sessions', fontsize=10)
plt.ylabel('Clinical Risk Score', fontsize=10)
plt.legend()
plt.grid(alpha=0.3)

# --- CHART 1.6: Average Risk by Frequency ---
plt.subplot(2, 3, 6)
avg_risk = patient_risk_df.groupby('Frequency_Category')['Clinical_Risk_Score'].mean()
bars = plt.bar(avg_risk.index, avg_risk.values, color=colors_freq, edgecolor='black', alpha=0.7)
plt.title('Average Risk Score by Dialysis Frequency', fontsize=12, fontweight='bold')
plt.xlabel('Dialysis Frequency', fontsize=10)
plt.ylabel('Average Risk Score', fontsize=10)
plt.grid(axis='y', alpha=0.3)
for bar in bars:
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2., height,
            f'{height:.1f}', ha='center', va='bottom', fontsize=9)

plt.tight_layout()
plt.savefig('Dashboard_Risk_Analysis.png', dpi=300, bbox_inches='tight')
print("\n✅ Dashboard saved as: 'Dashboard_Risk_Analysis.png'")
plt.show()

# --- EXPORT CRITICAL PATIENTS ---

# 1. Filter for the "Red Zone" (Score >= 30)
critical_patients = patient_risk_df[patient_risk_df['Clinical_Risk_Score'] >= 30].copy()

# 2. Add readable labels for the "Why" columns
critical_patients['Reason'] = np.where(
    critical_patients['SBP_mean'] < 100, 'Hypotension + Instability', 'Severe Volatility'
)

# 3. Select clean columns for the report
report_columns = [
    'Clinical_Risk_Score', 
    'Reason', 
    'SBP_mean', 
    'IDWG_CV', 
    'Dialysis_Frequency',
    'Frequency_Category',
    'Session_Count'
]

# 4. Sort by Risk (Highest first)
final_report = critical_patients[report_columns].sort_values(by='Clinical_Risk_Score', ascending=False)

# 5. Print Summary Stats
print(f"\n⚠️  CRITICAL ALERT REPORT ⚠️ ")
print(f"Total Patients in Red Zone: {len(final_report)}")
print(f"Average SBP in Red Zone: {final_report['SBP_mean'].mean():.1f} mmHg")
print(f"Average Dialysis Sessions: {final_report['Dialysis_Frequency'].mean():.0f} sessions")
print("-" * 70)
print(final_report.head(10))

# 6. Save to CSV
final_report.to_csv('High_Risk_Patients_Report.csv')
print("\n✅ File saved as: 'High_Risk_Patients_Report.csv'")

# 7. Additional Summary Statistics
print("\n" + "="*70)
print("📊 DASHBOARD SUMMARY STATISTICS")
print("="*70)
print(f"\nTotal Patients Analyzed: {len(patient_risk_df)}")
print(f"High Risk Patients (Score ≥ 30): {(patient_risk_df['Clinical_Risk_Score'] >= 30).sum()}")
print(f"Medium Risk Patients (15 ≤ Score < 30): {((patient_risk_df['Clinical_Risk_Score'] >= 15) & (patient_risk_df['Clinical_Risk_Score'] < 30)).sum()}")
print(f"Low Risk Patients (Score < 15): {(patient_risk_df['Clinical_Risk_Score'] < 15).sum()}")

print(f"\nAverage Clinical Risk Score: {patient_risk_df['Clinical_Risk_Score'].mean():.2f}")
print(f"Median Clinical Risk Score: {patient_risk_df['Clinical_Risk_Score'].median():.2f}")
print(f"Average Dialysis Sessions per Patient: {patient_risk_df['Dialysis_Frequency'].mean():.1f}")

print(f"\nCritical Correlation:")
corr_freq_risk = patient_risk_df['Dialysis_Frequency'].corr(patient_risk_df['Clinical_Risk_Score'])
print(f"   Dialysis Frequency ↔ Risk Score Correlation: {corr_freq_risk:.3f}")

# Additional Metrics for Dashboard
print("\n" + "="*70)
print("📈 ADDITIONAL DASHBOARD METRICS")
print("="*70)

# Blood Pressure Metrics
print(f"\nBlood Pressure Metrics:")
print(f"   Average Systolic BP: {patient_risk_df['SBP_mean'].mean():.1f} mmHg")
print(f"   Average Diastolic BP: {patient_risk_df['DBP_mean'].mean():.1f} mmHg")
print(f"   Patients with Hypotension (<100 mmHg): {(patient_risk_df['Hypotension_Flag'] == 1).sum()}")

# Weight Gain Volatility
print(f"\nWeight Gain Volatility:")
print(f"   Average IDWG CV: {patient_risk_df['IDWG_CV'].mean():.3f}")
print(f"   Std Dev of IDWG CV: {patient_risk_df['IDWG_CV'].std():.3f}")

# BP Instability
print(f"\nBP Instability Distribution:")
for rank in range(1, 5):
    count = (patient_risk_df['BP_Instability_Rank'] == rank).sum()
    print(f"   Rank {rank}: {count} patients")

# Risk Distribution
print(f"\nRisk Score Quartiles:")
q1, q2, q3 = patient_risk_df['Clinical_Risk_Score'].quantile([0.25, 0.5, 0.75])
print(f"   25th percentile: {q1:.1f}")
print(f"   50th percentile (Median): {q2:.1f}")
print(f"   75th percentile: {q3:.1f}")
print(f"   Max: {patient_risk_df['Clinical_Risk_Score'].max():.1f}")
print(f"   Min: {patient_risk_df['Clinical_Risk_Score'].min():.1f}")

print("\n" + "="*70)

# Export all patient data to CSV for dashboard
patient_risk_df.to_csv('Patient_Dashboard_Data.csv')
print("✅ Full patient data exported to: 'Patient_Dashboard_Data.csv'")

