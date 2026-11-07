import fs from 'fs';

const css = fs.readFileSync('src/components/dashboard-berry/berry-dashboard.css', 'utf-8');
const lines = css.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('border-radius:')) {
    const context = lines.slice(Math.max(0, idx - 6), idx + 2).join('\n');
    if (context.includes('hero-welcome-card') || context.includes('hero-gira-card') || context.includes('kpi-card') || context.includes('preceito-card') || context.includes('radar-card') || context.includes('attention-card') || context.includes('card')) {
      console.log(context);
      console.log('-----------------');
    }
  }
});
