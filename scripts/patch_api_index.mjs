import fs from 'fs';

const filePath = 'api/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

const target = `      if (error) throw error;
      res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
      res.json({ data });`;

const replacement = `      if (error) throw error;
      if (data) {
        const { data: leader } = await supabaseAdmin
          .from('perfil_lider')
          .select('cidade, whatsapp_publico, whatsapp')
          .eq('id', resolvedId)
          .maybeSingle();
        let detectedCity = String(leader?.cidade || '').trim();
        if (!detectedCity || detectedCity.toUpperCase() === 'BRASIL') {
          const phone = String(leader?.whatsapp_publico || leader?.whatsapp || '');
          const ddd = phone.replace(/\\D/g, '').slice(0, 4).replace(/^55/, '').slice(0, 2);
          if (ddd === '21' || ddd === '22' || ddd === '24') detectedCity = 'RIO DE JANEIRO';
          else if (ddd === '11' || ddd === '19' || ddd === '12' || ddd === '13') detectedCity = 'SAO PAULO';
          else if (ddd === '71' || ddd === '73' || ddd === '75') detectedCity = 'SALVADOR';
          else if (ddd === '31' || ddd === '32' || ddd === '34') detectedCity = 'BELO HORIZONTE';
          else if (ddd === '81' || ddd === '87') detectedCity = 'RECIFE';
          else if (ddd === '85' || ddd === '88') detectedCity = 'FORTALEZA';
          else if (ddd === '41' || ddd === '42') detectedCity = 'CURITIBA';
          else if (ddd === '51' || ddd === '53') detectedCity = 'PORTO ALEGRE';
          else if (ddd === '61') detectedCity = 'BRASILIA';
          else detectedCity = 'SAO PAULO';
        }
        data.cidade = detectedCity;
      }
      res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
      res.json({ data });`;

const targetCRLF = target.replace(/\n/g, '\r\n');

if (content.includes(targetCRLF)) {
  content = content.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated api/index.ts (CRLF)');
} else if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated api/index.ts (LF)');
} else {
  console.log('Target not found in api/index.ts');
}
