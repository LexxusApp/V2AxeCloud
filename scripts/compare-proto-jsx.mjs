import fs from 'fs';

const protoHtml = fs.readFileSync('C:/Users/Lucas A/Desktop/Axecloud-Dashboard-Local/index.html', 'utf8');
const shellJsx = fs.readFileSync('c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/dashboard-berry/BerryAppShell.tsx', 'utf8');
const dashJsx = fs.readFileSync('c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/dashboard-berry/DashboardBerry.tsx', 'utf8');

const protoClasses = new Set([...protoHtml.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
const jsxText = shellJsx + dashJsx;
const jsxMatches = [...jsxText.matchAll(/className=["'{`]([^"'}``\n]+)/g)].flatMap(m => m[1].split(/\s+/));
const jsxClasses = new Set(jsxMatches);

console.log('Proto classes count:', protoClasses.size);
console.log('JSX classes count:', jsxClasses.size);

const missingInJsx = [...protoClasses].filter(c => !jsxClasses.has(c));
console.log('Proto classes not in JSX count:', missingInJsx.length);
console.log('Missing in JSX:', missingInJsx);
