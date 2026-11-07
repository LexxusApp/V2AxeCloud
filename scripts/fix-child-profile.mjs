import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/views/ChildProfile.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldBlock = `      const fileName = \${user.id}-child--.;

      const response = await authFetch('/api/v1/profile/upload-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': Bearer 
        },
        body: JSON.stringify({
          fileData: compressed.fileData,
          fileName: fileName,
          contentType: compressed.contentType
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao subir foto.');
      }

      const { publicUrl } = await response.json();

      // Atualizar o banco de dados do filho
      const { error: dbError } = await supabase
        .from('filhos_de_santo')
        .update({ foto_url: publicUrl })
        .eq('id', child.id);

      if (dbError) throw dbError;

      setChild({ ...child, foto_url: publicUrl });
      showHouseToast('Foto de perfil atualizada com sucesso');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      showHouseToast(Erro ao atualizar foto: , 'error');
    } finally {
      setIsUploadingPhoto(false);
    }`;

const newBlock = `      const fileName = \`\${user.id}-child-\${child.id}-\${Date.now()}.\${compressed.extension}\`;

      const response = await authFetch('/api/v1/profile/upload-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${session.access_token}\`
        },
        body: JSON.stringify({
          fileData: compressed.fileData,
          fileName: fileName,
          contentType: compressed.contentType
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao subir foto.');
      }

      const { publicUrl } = await response.json();

      // Atualizar o banco de dados do filho
      const { error: dbError } = await supabase
        .from('filhos_de_santo')
        .update({ foto_url: publicUrl })
        .eq('id', child.id);

      if (dbError) throw dbError;

      setChild({ ...child, foto_url: publicUrl });
      showHouseToast('Foto de perfil atualizada com sucesso');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      showHouseToast(\`Erro ao atualizar foto: \${error.message || 'tente novamente'}\`, 'error');
    } finally {
      setIsUploadingPhoto(false);
    }`;

const norm = (s) => s.replace(/\r\n/g, '\n');
if (norm(content).includes(norm(oldBlock))) {
  content = norm(content).replace(norm(oldBlock), norm(newBlock));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS: ChildProfile.tsx fixed properly!');
} else {
  console.error('ERROR: oldBlock not found in ChildProfile.tsx');
}
