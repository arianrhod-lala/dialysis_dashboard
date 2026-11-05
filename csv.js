/**
 * @typedef {Object} AggregateExportRow
 * @property {string} Proxy_ID
 * @property {string} Session_Count
 * @property {string} SBP_mean
 * @property {string} SBP_std
 * @property {string} Interdialytic_Weight_Gain_mean
 * @property {string} Interdialytic_Weight_Gain_std
 * @property {string} IDWG_CV
 * @property {string} BP_Instability_Rank
 * @property {string} Clinical_Risk_Score
 */

/**
 * Parse the named export schema while preserving measurement strings.
 * @param {string} text UTF-8 CSV content, optionally with a BOM.
 * @returns {AggregateExportRow[]} Blank/invalid measurements remain for screening.
 * @throws {Error} For quoting, schema or row-width failures, with location where available.
 */
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed)
        throw new Error(`Invalid CSV quoting at character ${i + 1}.`);
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed)
        throw new Error(`Invalid text after CSV quote at character ${i + 1}.`);
      cell += c;
    }
  }
  if (quoted)
    throw new Error(`Unclosed CSV quote at character ${text.length}.`);
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  if (!rows.length) throw new Error("CSV is empty.");
  const headers = rows.shift();
  const required = [
    "Proxy_ID",
    "SBP_mean",
    "SBP_std",
    "Interdialytic_Weight_Gain_mean",
    "Interdialytic_Weight_Gain_std",
    "Session_Count",
    "IDWG_CV",
    "BP_Instability_Rank",
    "Clinical_Risk_Score",
  ];
  if (
    new Set(headers).size !== headers.length ||
    required.some((h) => !headers.includes(h))
  )
    throw new Error("CSV schema does not match the dashboard export.");
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `CSV data row ${index + 1} has an unexpected number of fields.`,
      );
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}
