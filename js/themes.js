export const THEMES = [
  { id: 'mossy-morning',     name: 'Mossy Morning',     mood: 'Botanical daylight',
    swatches: ['#4b6043', '#658354', '#87ab69', '#ddead1'] },
  { id: 'rainy-day-cafe',    name: 'Rainy Day Café',    mood: 'Warm coffee & soft shadows',
    swatches: ['#3e2f26', '#6b4f3a', '#a8846b', '#f3e8d8'] },
  { id: 'strawberry-milk',   name: 'Strawberry Milk',   mood: 'Blush pink & cream',
    swatches: ['#7a3b47', '#b56576', '#e8b4bc', '#fdf2f4'] },
  { id: 'lavender-twilight', name: 'Lavender Twilight', mood: 'Dreamy evening violet',
    swatches: ['#4a3f6b', '#7b6aa8', '#b8a9d9', '#d6d9ec'] },
  { id: 'midnight-library',  name: 'Midnight Library',  mood: 'Dark cozy study',
    swatches: ['#1c2620', '#2a3a2e', '#c9a961', '#e6e3d6'] },
  { id: 'sunday-morning',    name: 'Sunday Morning',    mood: 'Quiet oatmeal minimal',
    swatches: ['#6b6257', '#a89a86', '#d4c8b8', '#faf7f2'] },
];

export const DEFAULT_THEME = 'mossy-morning';

export function isValidTheme(id) {
  return THEMES.some((t) => t.id === id);
}

export function getThemeMeta(id) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}