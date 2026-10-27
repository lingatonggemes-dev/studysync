import { createStore } from './store.js';

export const schemesStore = createStore('gradingSchemes');
export const subjectsStore = createStore('gradeSubjects');
export const assessmentsStore = createStore('assessments');

/* ---------- Default Schemes ---------- */
export function initDefaultSchemes() {
  if (schemesStore.all().length > 0) return;

  schemesStore.add({
    name: 'Percentage (0-100)',
    highest: 100, lowest: 0, passing: 75,
    isInverted: false, // 100 is highest
  });

  schemesStore.add({
    name: '1.00 is Highest (Mapua/UP)',
    highest: 1.00, lowest: 4.00, passing: 3.00,
    isInverted: false, // 1.00 is highest
  });

  schemesStore.add({
    name: '4.00 is Highest (NU MOA)',
    highest: 4.00, lowest: 1.00, passing: 2.00,
    isInverted: true, // 4.00 is highest
  });
}

/* ---------- Math Engine ---------- */
export function calculateSubjectGrade(subjectId) {
  const subject = subjectsStore.byId(subjectId);
  if (!subject) return null;

  const scheme = schemesStore.byId(subject.schemeId);
  if (!scheme) return { percent: 0, finalGrade: 'N/A', status: 'No scheme' };

  const assessments = assessmentsStore.all().filter(a => a.subjectId === subjectId);
  const categories = subject.categories || []; // e.g. [{name: 'Quizzes', weight: 30}]

  if (categories.length === 0) return { percent: 0, finalGrade: 'N/A', status: 'No categories' };
  
  let totalWeightedPercent = 0;
  let totalWeightEntered = 0;
  let hasData = false;

  for (const cat of categories) {
    const catAssessments = assessments.filter(a => a.category === cat.name);
    if (catAssessments.length === 0) continue;

    const totalScore = catAssessments.reduce((sum, a) => sum + Number(a.score), 0);
    const totalMax = catAssessments.reduce((sum, a) => sum + Number(a.maxScore), 0);
    
    if (totalMax > 0) {
      const catPercent = (totalScore / totalMax) * 100;
      totalWeightedPercent += catPercent * (cat.weight / 100);
      totalWeightEntered += cat.weight;
      hasData = true;
    }
  }

  if (!hasData) return { percent: 0, finalGrade: 'N/A', status: 'No scores yet' };

  // Adjust for missing weights (e.g., only Quizzes entered, Exams not yet taken)
  const currentPercent = (totalWeightedPercent / totalWeightEntered) * 100; 

  // Convert Percentage to the User's Scale
  const finalGrade = convertPercentToScale(currentPercent, scheme);

  return {
    percent: currentPercent.toFixed(2),
    finalGrade,
    status: totalWeightEntered === 100 ? 'Complete' : 'Incomplete',
  };
}

function convertPercentToScale(percent, scheme) {
  // If the system is 0-100, just return the percent
  if (scheme.highest === 100) return percent.toFixed(2);

  // Linear interpolation: 100% -> highest, 0% -> lowest
  const range = scheme.lowest - scheme.highest;
  const grade = scheme.highest + (range * (1 - (percent / 100)));

  // Round to 2 decimals (e.g., 1.50, 3.25)
  return grade.toFixed(2);
}