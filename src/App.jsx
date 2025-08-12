import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";

/* ========= Utils ========= */
const eur = (n) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(Number.isFinite(n) ? n : 0);

const clamp = (x, min, max) => Math.min(Math.max(x, min), max);

/* mensualité requise pour atteindre une cible future */
function paymentForTarget({ principal, target, annualRate, months }) {
  const i = annualRate / 12;
  if (months <= 0) return 0;
  if (i === 0) return Math.max(0, (target - principal) / months);
  const pow = Math.pow(1 + i, months);
  const numerator = target - principal * pow;
  const denom = (pow - 1) / i;
  return Math.max(0, numerator / denom);
}

/* temps jusqu’à FI (cible indexée sur l’inflation) */
function timeToFI({ principal, monthly, annualReturn, annualInflation, annualExpenses, swr, maxYears = 80 }) {
  const monthsMax = Math.round(maxYears * 12);
  const r = annualReturn / 12;
  const inf = annualInflation / 12;
  let bal = principal;
  let target = (annualExpenses / (swr || 0.000001)); // protège si 0% pendant la saisie
  for (let m = 1; m <= monthsMax; m++) {
    bal = bal * (1 + r) + monthly;
    target = target * (1 + inf);
    if (bal >= target) return { months: m, targetAtHit: target, balanceAtHit: bal };
  }
  return { months: Infinity, targetAtHit: target, balanceAtHit: bal };
}

/* série annuelle pour le graphique */
function series({ principal, monthly, annualReturn, annualInflation, annualExpenses, swr, years }) {
  const months = Math.round(years * 12);
  const r = annualReturn / 12;
  const inf = annualInflation / 12;
  let bal = principal;
  let target = (annualExpenses / (swr || 0.000001));
  const data = [];
  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      bal = bal * (1 + r) + monthly;
      target = target * (1 + inf);
    }
    if (m % 12 === 0) {
      data.push({
        name: `${m / 12} an${m / 12 > 1 ? "s" : ""}`,
        Portefeuille: Number.isFinite(bal) ? bal : null,
        "Cible FI (inflation)": Number.isFinite(target) ? target : null,
      });
    }
  }
  return data;
}

/* ========= Champ + curseur ========= */
function NumberControl({
  label, desc,
  valueNum, setValueNum,
  valueStr, setValueStr,
  unit = "", min = 0, max = 1000000, step = 1,
  sliderMin = min, sliderMax = max, sliderStep = step,
  formatOut = (x) => x, parseIn = (s) => Number(s)
}) {
  const labelStyle = {
    display:'block', background:'#fef9c3', border:'2px solid #facc15',
    borderRadius:12, padding:'10px 12px', margin:'10px 0',
    boxShadow:'0 2px 4px rgba(0,0,0,0.06)'
  };
  const inputStyle = {
    width:'100%', padding:10, marginTop:6,
    border:'1px solid #d97706', borderRadius:10, fontSize:16, background:'#fff', color:'#111827'
  };
  const descStyle = { fontSize:'0.85em', color:'#6b7280', marginTop:6 };
  const sliderStyle = { width:'100%', marginTop:8, appearance:'none', height:6, borderRadius:6, background:'#fde68a' };

  const onTextChange = (e) => {
    setValueStr(e.target.value);
    const n = parseIn(e.target.value.replace(',', '.'));
    if (!isNaN(n)) setValueNum(clamp(n, min, max));
  };
  const onTextBlur = () => {
    const n = parseIn(valueStr.replace(',', '.'));
    const c = isNaN(n) ? valueNum : clamp(n, min, max);
    setValueStr(String(c));
    setValueNum(c);
  };
  const onSlider = (e) => {
    const raw = Number(e.target.value);
    const isPercent = formatOut(1) === 100;
    const n = isPercent ? raw / 100 : raw;
    const c = clamp(n, min, max);
    setValueNum(c);
    setValueStr(String(c));
  };

  return (
    <label style={labelStyle}>
      <span style={{fontWeight:700, color:'#92400e'}}>{label}</span>
      <input type="text" value={valueStr} onChange={onTextChange} onBlur={onTextBlur}
             inputMode="decimal" style={inputStyle} aria-label={label} placeholder={unit} />
      <input type="range" min={sliderMin} max={sliderMax} step={sliderStep}
             value={formatOut(valueNum)} onChange={onSlider} style={sliderStyle} />
      <div style={descStyle}>{desc}</div>
    </label>
  );
}

/* ========= App (light only) ========= */
export default function App() {
  // États numériques
  const [principal, setPrincipal] = useState(18486.05);
  const [monthly, setMonthly] = useState(300);
  const [annualReturn, setAnnualReturn] = useState(0.06);
  const [annualInflation, setAnnualInflation] = useState(0.02);
  const [swr, setSwr] = useState(0.04);
  const [monthlyExpenses, setMonthlyExpenses] = useState(1500);
  const [horizon, setHorizon] = useState(30);
  const [targetYears, setTargetYears] = useState(15);

  // États texte (effaçables)
  const [principalStr, setPrincipalStr] = useState(String(principal));
  const [monthlyStr, setMonthlyStr] = useState(String(monthly));
  const [annualReturnStr, setAnnualReturnStr] = useState(String((annualReturn * 100).toFixed(1)));
  const [annualInflationStr, setAnnualInflationStr] = useState(String((annualInflation * 100).toFixed(1)));
  const [swrStr, setSwrStr] = useState(String((swr * 100).toFixed(1)));
  const [monthlyExpensesStr, setMonthlyExpensesStr] = useState(String(monthlyExpenses));
  const [horizonStr, setHorizonStr] = useState(String(horizon));
  const [targetYearsStr, setTargetYearsStr] = useState(String(targetYears));

  // Dérivés
  const annualExpenses = monthlyExpenses * 12;
  const fiTargetToday = annualExpenses / (swr || 0.000001);
  const tfi = useMemo(
    () => timeToFI({ principal, monthly, annualReturn, annualInflation, annualExpenses, swr, maxYears: 80 }),
    [principal, monthly, annualReturn, annualInflation, annualExpenses, swr]
  );
  const yearsToFI = Number.isFinite(tfi.months) ? tfi.months / 12 : Infinity;

  const data = useMemo(
    () => series({ principal, monthly, annualReturn, annualInflation, annualExpenses, swr, years: horizon }),
    [principal, monthly, annualReturn, annualInflation, annualExpenses, swr, horizon]
  );

  const targetFVAtYears = useMemo(
    () => fiTargetToday * Math.pow(1 + annualInflation, targetYears),
    [fiTargetToday, annualInflation, targetYears]
  );

  const neededMonthly = useMemo(
    () => paymentForTarget({ principal, target: targetFVAtYears, annualRate: annualReturn, months: Math.round(targetYears * 12) }),
    [principal, targetFVAtYears, annualReturn, targetYears]
  );

  // Styles (light only)
  const section = {
    maxWidth: 900, margin: "0 auto", padding: 20,
    color: "#0f172a", background: "#ffffff",
    fontFamily:'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    fontSize: 16
  };
  const tipBox = { background:'#fef3c7', border:'1px solid #fbbf24', padding:12, borderRadius:12, margin:'12px 0', fontSize:'0.9em' };
  const grid = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 };
  const headerBtn = { padding:'8px 12px', background:'#facc15', color:'#111827', border:'none', borderRadius:8, cursor:'pointer', marginRight:8 };
  const actionBtn = { padding:'8px 12px', background:'#e5e7eb', color:'#111827', border:'1px solid #cbd5e1', borderRadius:8, cursor:'pointer', marginRight:8 };
  const panelStyle = { height: 360, width:"100%", background:'#f9fafb', borderRadius:8, padding:10 };
  const lineColorA = '#2563eb';
  const lineColorB = '#16a34a';

  // Actions
  function handleResetTR() {
    setPrincipal(18486.05); setPrincipalStr("18486.05");
    setMonthly(300); setMonthlyStr("300");
    setAnnualReturn(0.06); setAnnualReturnStr("6.0");
    setAnnualInflation(0.02); setAnnualInflationStr("2.0");
    setSwr(0.04); setSwrStr("4.0");
    setMonthlyExpenses(1500); setMonthlyExpensesStr("1500");
    setHorizon(30); setHorizonStr("30");
    setTargetYears(15); setTargetYearsStr("15");
  }

  function handleExportPDF() {
    const w = window.open("", "_blank");
    if (!w) return;
    const style = `
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        table { border-collapse: collapse; width: 100%; margin-top: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
        th { background: #f3f4f6; text-align: left; }
        .kpi { margin-bottom: 8px; }
      </style>`;
    const head = `
      <h1>Rapport de simulation FI</h1>
      <div class="kpi"><strong>Valeur actuelle:</strong> ${eur(principal)}</div>
      <div class="kpi"><strong>Apport mensuel:</strong> ${eur(monthly)}</div>
      <div class="kpi"><strong>Rendement annuel:</strong> ${(annualReturn * 100).toFixed(1)}%</div>
      <div class="kpi"><strong>Inflation annuelle:</strong> ${(annualInflation * 100).toFixed(1)}%</div>
      <div class="kpi"><strong>SWR:</strong> ${(swr * 100).toFixed(1)}%</div>
      <div class="kpi"><strong>Dépenses mensuelles:</strong> ${eur(monthlyExpenses)}</div>
      <div class="kpi"><strong>Horizon:</strong> ${horizon} ans</div>
      <div class="kpi"><strong>Objectif FI:</strong> ${targetYears} ans</div>
      <div class="kpi"><strong>Mensualité requise (${targetYears} ans):</strong> ${eur(Math.round(neededMonthly))}</div>
      <div class="kpi"><strong>Temps estimé jusqu’à FI:</strong> ${Number.isFinite(yearsToFI) ? yearsToFI.toFixed(1) + " ans" : "Non atteint en 80 ans"}</div>
    `;
    const tableRows = data.map(d => `
      <tr>
        <td>${d.name}</td>
        <td>${Number.isFinite(d.Portefeuille) ? eur(d.Portefeuille) : ""}</td>
        <td>${Number.isFinite(d["Cible FI (inflation)"]) ? eur(d["Cible FI (inflation)"]) : ""}</td>
      </tr>
    `).join("");
    const html = `
      <html><head><meta charset="utf-8">${style}</head><body>
      ${head}
      <table>
        <thead><tr><th>Année</th><th>Portefeuille</th><th>Cible FI (inflation)</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  // Mini tests (s'exécutent une fois)
  useEffect(() => {
    try {
      const p1 = paymentForTarget({ principal: 0, target: 10000, annualRate: 0, months: 100 });
      console.assert(Math.abs(p1 - 100) < 1e-9, 'Test1: PMT sans intérêt doit être 100');

      const s2 = series({ principal: 0, monthly: 0, annualReturn: 0, annualInflation: 0, annualExpenses: 12000, swr: 0.04, years: 2 });
      console.assert(s2.length === 3, 'Test2: série annuelle sur 2 ans doit donner 3 points');

      const t3 = timeToFI({ principal: 0, monthly: 0, annualReturn: 0, annualInflation: 0, annualExpenses: 12000, swr: 0.04, maxYears: 30 });
      console.assert(t3.months === Infinity, 'Test3: sans apports ni rendement, FI non atteinte');
    } catch (e) {
      console.warn('Tests internes: erreur', e);
    }
  }, []);

  const hasData = Array.isArray(data) && data.some(
    d => d && (d.Portefeuille != null || d["Cible FI (inflation)"] != null)
  );

  return (
    <div style={section}>
      <motion.h1 initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: 30, fontWeight: 800, textAlign:'center', marginBottom: 18 }}>
        Simulateur d’indépendance financière
      </motion.h1>

      <div style={{ textAlign:'center', marginBottom: 15 }}>
        <button style={headerBtn} onClick={handleResetTR}>Réinitialiser (données Trade Republic)</button>
        <button style={actionBtn} onClick={handleExportPDF}>Export PDF</button>
      </div>

      <div style={tipBox}><strong>🟡 Astuce :</strong> Chaque carte jaune est modifiable. Utilisez la zone de texte <em>ou</em> le curseur.</div>

      <div style={grid}>
        <NumberControl label="Valeur actuelle (€)" desc="Valeur totale de vos investissements aujourd'hui."
          valueNum={principal} setValueNum={setPrincipal}
          valueStr={principalStr} setValueStr={setPrincipalStr}
          unit="€" min={0} max={1_000_000} step={1}
          sliderMin={0} sliderMax={200_000} sliderStep={1000}
        />

        <NumberControl label="Apport mensuel (€)" desc="Montant que vous investissez chaque mois."
          valueNum={monthly} setValueNum={setMonthly}
          valueStr={monthlyStr} setValueStr={setMonthlyStr}
          unit="€" min={0} max={50_000} step={1}
          sliderMin={0} sliderMax={5_000} sliderStep={50}
        />

        <NumberControl label="Rendement annuel attendu (%)" desc="Taux de croissance annuel estimé (après frais et impôts)."
          valueNum={annualReturn} setValueNum={setAnnualReturn}
          valueStr={annualReturnStr} setValueStr={setAnnualReturnStr}
          unit="%" min={0} max={1} step={0.001}
          sliderMin={0} sliderMax={20} sliderStep={0.1}
          formatOut={(x)=> x*100} parseIn={(s)=> Number(s)/100 }
        />

        <NumberControl label="Inflation annuelle (%)" desc="Taux d'augmentation des prix par an."
          valueNum={annualInflation} setValueNum={setAnnualInflation}
          valueStr={annualInflationStr} setValueStr={setAnnualInflationStr}
          unit="%" min={0} max={0.2} step={0.001}
          sliderMin={0} sliderMax={10} sliderStep={0.1}
          formatOut={(x)=> x*100} parseIn={(s)=> Number(s)/100 }
        />

        <NumberControl label="Taux de retrait sûr (SWR, %)" desc="Pourcentage du portefeuille retiré chaque année à la retraite."
          valueNum={swr} setValueNum={setSwr}
          valueStr={swrStr} setValueStr={setSwrStr}
          unit="%" min={0.01} max={0.1} step={0.0005}
          sliderMin={2} sliderMax={6} sliderStep={0.1}
          formatOut={(x)=> x*100} parseIn={(s)=> Number(s)/100 }
        />

        <NumberControl label="Dépenses mensuelles (€)" desc="Vos dépenses mensuelles prévues une fois indépendant financièrement."
          valueNum={monthlyExpenses} setValueNum={setMonthlyExpenses}
          valueStr={monthlyExpensesStr} setValueStr={setMonthlyExpensesStr}
          unit="€" min={0} max={50_000} step={1}
          sliderMin={0} sliderMax={10_000} sliderStep={50}
        />

        <NumberControl label="Horizon affiché (années)" desc="Nombre d'années affichées sur le graphique."
          valueNum={horizon} setValueNum={setHorizon}
          valueStr={horizonStr} setValueStr={setHorizonStr}
          min={1} max={80} step={1}
          sliderMin={1} sliderMax={80} sliderStep={1}
        />

        <NumberControl label="Objectif d’horizon pour FI (années)" desc="Quand vous souhaitez atteindre la FI. Utilisé pour calculer la mensualité requise."
          valueNum={targetYears} setValueNum={setTargetYears}
          valueStr={targetYearsStr} setValueStr={setTargetYearsStr}
          min={1} max={80} step={1}
          sliderMin={1} sliderMax={80} sliderStep={1}
        />
      </div>

      <h3 style={{ marginTop: 20, fontWeight:700 }}>Indicateurs clés</h3>
      <p><strong>Cible FI (aujourd’hui):</strong> {eur(fiTargetToday)}</p>
      <p><strong>Dépenses annuelles:</strong> {eur(monthlyExpenses * 12)}</p>
      <p><strong>Temps estimé jusqu’à FI:</strong> {Number.isFinite(yearsToFI) ? `${yearsToFI.toFixed(1)} ans` : "Non atteint en 80 ans"}</p>
      <p><strong>Mensualité requise pour atteindre la FI en {targetYears} ans :</strong> {eur(Math.round(neededMonthly))}</p>

      <h3 style={{ marginTop: 20, fontWeight:700 }}>Courbe d’évolution</h3>
      <div style={panelStyle}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Portefeuille" stroke={lineColorA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Cible FI (inflation)" stroke={lineColorB} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
