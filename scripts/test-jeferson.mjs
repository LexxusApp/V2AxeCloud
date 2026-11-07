async function test() {
  const res = await fetch('https://axecloud.com.br/api/auth/filho-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childId: '54997099821', cpfPrefix: '595888' }),
  });
  console.log('Status Jeferson:', res.status);
  const data = await res.json();
  console.log('Response Jeferson:', {
    hasToken: !!data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    error: data.error,
  });
}

test().catch(console.error);
