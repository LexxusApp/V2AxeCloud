import fs from 'node:fs';
import path from 'node:path';

// 1. SettingsProfilePanel.tsx
{
  const filePath = path.resolve('src/components/settings/SettingsProfilePanel.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('compressImage')) {
    content = `import { compressImage } from '../../lib/imageCompression';\n` + content;
  }

  // Substituir a função handlePhotoUpload
  const oldPhotoFn = `  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Selecione uma imagem (JPG, PNG ou WebP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('A imagem deve ter no máximo 5 MB.', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = \`\${user.id}-\${Date.now()}.\${fileExt}\`;
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const encoded = result.split(',')[1];
          if (!encoded) reject(new Error('Falha ao ler a imagem.'));
          else resolve(encoded);
        };
        reader.onerror = () => reject(new Error('Erro ao processar a imagem.'));
        reader.readAsDataURL(file);
      });

      const response = await authFetch('/api/v1/profile/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName,
          contentType: file.type,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar foto.');
      }

      setProfileFoto(String(data.publicUrl || ''));
      notify('Foto carregada! Clique em Salvar para confirmar no perfil.', 'info');`;

  const newPhotoFn = `  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Selecione uma imagem (JPG, PNG ou WebP).', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Compressão client-side (evita HTTP 413 em fotos pesadas de celulares)
      const compressed = await compressImage(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.82,
      });

      const fileName = \`\${user.id}-\${Date.now()}.\${compressed.extension}\`;

      const response = await authFetch('/api/v1/profile/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: compressed.fileData,
          fileName,
          contentType: compressed.contentType,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar foto.');
      }

      setProfileFoto(String(data.publicUrl || ''));
      notify('Foto carregada! Clique em Salvar para confirmar no perfil.', 'info');`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldPhotoFn))) {
    content = norm(content).replace(norm(oldPhotoFn), norm(newPhotoFn));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: SettingsProfilePanel.tsx atualizado');
  } else {
    console.warn('WARN: Não foi possível localizar oldPhotoFn em SettingsProfilePanel.tsx');
  }
}

// 2. ClaimedDirectoryProfileSettings.tsx
{
  const filePath = path.resolve('src/components/settings/ClaimedDirectoryProfileSettings.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('compressImage')) {
    content = `import { compressImage } from '../../lib/imageCompression';\n` + content;
  }

  const oldCode = `    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Selecione uma imagem (JPG, PNG ou WebP).', kind: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: 'A imagem deve ter no máximo 5 MB.', kind: 'error' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const encoded = result.split(',')[1];
          if (!encoded) reject(new Error('Falha ao ler a imagem.'));
          else resolve(encoded);
        };
        reader.onerror = () => reject(new Error('Erro ao processar a imagem.'));
        reader.readAsDataURL(file);
      });

      const response = await authFetch('/api/v1/settings/directory-profile/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: \`diretorio.\${fileExt}\`,
          contentType: file.type,
        }),
      });`;

  const newCode = `    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Selecione uma imagem (JPG, PNG ou WebP).', kind: 'error' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      // Compressão client-side (evita HTTP 413 em fotos pesadas de celulares)
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.84,
      });

      const response = await authFetch('/api/v1/settings/directory-profile/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: compressed.fileData,
          fileName: \`diretorio.\${compressed.extension}\`,
          contentType: compressed.contentType,
        }),
      });`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldCode))) {
    content = norm(content).replace(norm(oldCode), norm(newCode));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: ClaimedDirectoryProfileSettings.tsx atualizado');
  } else {
    console.warn('WARN: Não foi possível localizar oldCode em ClaimedDirectoryProfileSettings.tsx');
  }
}

// 3. DirectoryPublicProfileSettings.tsx
{
  const filePath = path.resolve('src/components/settings/DirectoryPublicProfileSettings.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('compressImage')) {
    content = `import { compressImage } from '../../lib/imageCompression';\n` + content;
  }

  const oldCode = `async function uploadImage(file: File, kind: 'cover' | 'gallery'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '').split(',')[1];
      value ? resolve(value) : reject(new Error('Não foi possível ler a imagem.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
  const response = await authFetch('/api/v1/settings/directory-profile/upload-photo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileData, fileName: file.name, contentType: file.type, kind }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.publicUrl) throw new Error(json.error || 'Erro ao enviar imagem.');
  return String(json.publicUrl);
}`;

  const newCode = `async function uploadImage(file: File, kind: 'cover' | 'gallery'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
  const maxDim = kind === 'cover' ? 1600 : 1280;
  const compressed = await compressImage(file, {
    maxWidth: maxDim,
    maxHeight: maxDim,
    quality: 0.84,
  });
  const response = await authFetch('/api/v1/settings/directory-profile/upload-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileData: compressed.fileData,
      fileName: file.name,
      contentType: compressed.contentType,
      kind,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.publicUrl) throw new Error(json.error || 'Erro ao enviar imagem.');
  return String(json.publicUrl);
}`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldCode))) {
    content = norm(content).replace(norm(oldCode), norm(newCode));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: DirectoryPublicProfileSettings.tsx atualizado');
  } else {
    console.warn('WARN: Não foi possível localizar oldCode em DirectoryPublicProfileSettings.tsx');
  }
}

// 4. Register.tsx
{
  const filePath = path.resolve('src/views/Register.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('compressImage')) {
    content = `import { compressImage } from '../lib/imageCompression';\n` + content;
  }

  const oldCode = `      if (profilePhoto && signInData.session?.access_token) {
        try {
          const fileData = await fileToBase64(profilePhoto);
          const uploadResponse = await fetch('/api/v1/settings/directory-profile/upload-photo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: \`Bearer \${signInData.session.access_token}\`,
            },
            body: JSON.stringify({
              fileData,
              fileName: profilePhoto.name,
              contentType: profilePhoto.type || 'image/jpeg',
            }),
          });`;

  const newCode = `      if (profilePhoto && signInData.session?.access_token) {
        try {
          const compressed = await compressImage(profilePhoto, {
            maxWidth: 1024,
            maxHeight: 1024,
            quality: 0.82,
          });
          const uploadResponse = await fetch('/api/v1/settings/directory-profile/upload-photo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: \`Bearer \${signInData.session.access_token}\`,
            },
            body: JSON.stringify({
              fileData: compressed.fileData,
              fileName: \`diretorio.\${compressed.extension}\`,
              contentType: compressed.contentType,
            }),
          });`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldCode))) {
    content = norm(content).replace(norm(oldCode), norm(newCode));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: Register.tsx atualizado');
  } else {
    console.warn('WARN: Não foi possível localizar oldCode em Register.tsx');
  }
}
