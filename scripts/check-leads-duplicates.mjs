import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const map = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const url = map['VITE_SUPABASE_URL'];
const key = map['SUPABASE_SERVICE_ROLE_KEY'];

async function checkLeads() {
  const res = await fetch(`${url}/rest/v1/prospecting_leads?select=id,name,city,state,phone,directory_id,created_at&order=created_at.desc&limit=100`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const leads = await res.json();
  console.log(`Total leads returned: ${leads.length}`);
  
  // Group by name
  const nameCounts = {};
  for (const l of leads) {
    nameCounts[l.name] = (nameCounts[l.name] || 0) + 1;
  }
  
  const duplicates = Object.entries(nameCounts).filter(([_, count]) => count > 1);
  console.log(`Unique names: ${Object.keys(nameCounts).length}`);
  console.log(`Names with > 1 occurrence:`, duplicates.slice(0, 10));
  
  if (leads.length > 0) {
    console.log('Sample leads:', leads.slice(0, 5));
  }
}

checkLeads();
