export const capitalize = (text: string) =>
  text[0].toUpperCase() + text.substr(1, text.length);
export const weightDescription = (weight: number) =>
  weight === 400 ? '常规' : weight === 500 ? '中等' : '加粗';
