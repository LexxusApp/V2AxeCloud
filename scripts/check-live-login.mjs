async function check() {
  const r = await fetch('https://axecloud.com.br/entrar');
  console.log('Status /entrar:', r.status);
  const text = await r.text();
  console.log('Contains root:', text.includes('id="root"'));
  console.log('Length:', text.length);

  const r2 = await fetch('https://axecloud.com.br/login');
  console.log('Status /login:', r2.status);

  const r3 = await fetch('https://axecloud.com.br/login-bg-trident.png');
  console.log('Status /login-bg-trident.png:', r3.status);

  const r4 = await fetch('https://axecloud.com.br/axecloud-trident.png');
  console.log('Status /axecloud-trident.png:', r4.status);
}
check().catch(console.error);
