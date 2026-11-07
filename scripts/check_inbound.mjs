const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYW9qaGZ3aHFtd3VkcXN1bXBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIwNDE2NCwiZXhwIjoyMDkwNzgwMTY0fQ.3BmBPr8C7LegYLaF4F4fWJOUvQblfbEeZKXMmOate9o';
const url = 'https://vlaojhfwhqmwudqsumpi.supabase.co/rest/v1';

async function main() {
  const res = await fetch(`${url}/admin_whatsapp_messages?select=*&order=created_at.desc&limit=5`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const msgs = await res.json();
  console.log('Recent messages:', JSON.stringify(msgs, null, 2));

  const res2 = await fetch(`${url}/prospecting_conversations?select=*&order=updated_at.desc&limit=5`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const convs = await res2.json();
  console.log('Prospecting conversations:', JSON.stringify(convs, null, 2));
}

main().catch(console.error);
