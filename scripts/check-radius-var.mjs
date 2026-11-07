import fs from 'fs';

const css = fs.readFileSync('src/components/dashboard-berry/berry-dashboard.css', 'utf-8');
const matches = css.match(/--radius-card:[^;]+;/g);
console.log('Matches for --radius-card:', matches);
