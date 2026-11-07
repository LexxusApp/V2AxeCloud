import fs from 'node:fs';
import path from 'node:path';

// 1. ChildProfileEditModal.tsx
{
  const filePath = path.resolve('src/components/child-profile/ChildProfileEditModal.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  const oldWhatsAppBlock = `              <div className="col-span-2">
                <label className={fieldLabel}>WhatsApp</label>
                <input
                  type="tel"
                  value={resolveChildWhatsAppPhone(editData)}
                  onChange={(e) => onChange('whatsapp_phone', e.target.value)}
                  placeholder="11999999999"
                  className={fieldInput}
                />
              </div>`;

  const newWhatsAppBlock = `              <div className="col-span-2 sm:col-span-2">
                <label className={fieldLabel}>WhatsApp</label>
                <input
                  type="tel"
                  value={resolveChildWhatsAppPhone(editData)}
                  onChange={(e) => onChange('whatsapp_phone', e.target.value)}
                  placeholder="11999999999"
                  className={fieldInput}
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label className={fieldLabel}>E-mail (acesso ao portal)</label>
                <input
                  type="email"
                  value={String(editData.email || '')}
                  onChange={(e) => onChange('email', e.target.value.trim().toLowerCase())}
                  placeholder="filho@exemplo.com"
                  className={fieldInput}
                />
                <p className="mt-1 text-[10px] text-[#8A8070]">
                  Permite ao filho entrar no portal usando o próprio e-mail pessoal.
                </p>
              </div>`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldWhatsAppBlock))) {
    content = norm(content).replace(norm(oldWhatsAppBlock), norm(newWhatsAppBlock));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: ChildProfileEditModal.tsx atualizado com campo de e-mail');
  } else {
    console.warn('WARN: oldWhatsAppBlock não encontrado em ChildProfileEditModal.tsx');
  }
}

// 2. ChildProfileV3View.tsx
{
  const filePath = path.resolve('src/components/child-profile/ChildProfileV3View.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  const oldFieldBlock = `                    <InfoField label="Localização / Residência" value={endereco || EMPTY} />
                    <InfoField label="WhatsApp de Contato" value={contato || EMPTY} />`;

  const newFieldBlock = `                    <InfoField label="Localização / Residência" value={endereco || EMPTY} />
                    <InfoField label="WhatsApp de Contato" value={contato || EMPTY} />
                    <InfoField label="E-mail de Acesso" value={child.email || EMPTY} />`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldFieldBlock))) {
    content = norm(content).replace(norm(oldFieldBlock), norm(newFieldBlock));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: ChildProfileV3View.tsx atualizado com exibição de e-mail');
  } else {
    console.warn('WARN: oldFieldBlock não encontrado em ChildProfileV3View.tsx');
  }
}

// 3. Children.tsx
{
  const filePath = path.resolve('src/views/Children.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  // Adicionar Mail nos imports de lucide-react se não houver
  if (!content.includes('Mail,')) {
    content = content.replace("import { Info, Plus,", "import { Info, Plus, Mail,");
  }

  // Atualizar ChildForm e EMPTY_CHILD_FORM
  const oldFormType = `type ChildForm = {
  nome: string;
  orixa_frente: string;
  cargo: string;
  cpf: string;
  data_nascimento: string;
  data_entrada: string;
  status: Child['status'];
  foto_url: string;
  whatsapp_phone: string;
};`;

  const newFormType = `type ChildForm = {
  nome: string;
  orixa_frente: string;
  cargo: string;
  cpf: string;
  data_nascimento: string;
  data_entrada: string;
  status: Child['status'];
  foto_url: string;
  whatsapp_phone: string;
  email?: string;
};`;

  const oldEmptyForm = `  foto_url: '',
  whatsapp_phone: '',
};`;

  const newEmptyForm = `  foto_url: '',
  whatsapp_phone: '',
  email: '',
};`;

  // Adicionar campo de input no formulário de cadastro
  const oldFormWhatsApp = `                  <div>
                    <label className={paperLabelClass}>WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6F675C]" />
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10,13}"
                        title="Informe DDD + número, somente dígitos (ex: 11999999999)"
                        maxLength={13}
                        className={cn(paperInputClass, 'pl-9')}
                        value={formData.whatsapp_phone}
                        onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value.replace(/\\D/g, '') })}
                        placeholder="11999999999"
                      />
                    </div>
                  </div>`;

  const newFormWhatsApp = `                  <div>
                    <label className={paperLabelClass}>WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6F675C]" />
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10,13}"
                        title="Informe DDD + número, somente dígitos (ex: 11999999999)"
                        maxLength={13}
                        className={cn(paperInputClass, 'pl-9')}
                        value={formData.whatsapp_phone}
                        onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value.replace(/\\D/g, '') })}
                        placeholder="11999999999"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={paperLabelClass}>E-mail (opcional)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6F675C]" />
                      <input
                        type="email"
                        className={cn(paperInputClass, 'pl-9')}
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value.trim().toLowerCase() })}
                        placeholder="filho@exemplo.com"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-[#8A8070]">
                      Permite ao filho entrar no portal usando o próprio e-mail pessoal.
                    </p>
                  </div>`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldFormType))) {
    content = norm(content).replace(norm(oldFormType), norm(newFormType));
  }
  if (norm(content).includes(norm(oldEmptyForm))) {
    content = norm(content).replace(norm(oldEmptyForm), norm(newEmptyForm));
  }
  if (norm(content).includes(norm(oldFormWhatsApp))) {
    content = norm(content).replace(norm(oldFormWhatsApp), norm(newFormWhatsApp));
    console.log('OK: Children.tsx formulário atualizado com campo de e-mail');
  } else {
    console.warn('WARN: oldFormWhatsApp não encontrado em Children.tsx');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// 4. Login.tsx
{
  const filePath = path.resolve('src/views/Login.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  // Atualizar a validação e chamada no handleSubmit
  const oldLoginValidation = `        if (!isValidFilhoLoginId(childId)) {
          throw new Error('Informe o registro (ex.: AXC-2021-B2CA). Pode digitar com ou sem hífen.');
        }
        if (cpfPrefix.length < 6) {
          throw new Error('Digite os 6 primeiros dígitos do CPF.');
        }

        const response = await fetch('/api/auth/filho-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: normalizeFilhoLoginIdInput(childId) || childId,
            cpfPrefix,
          }),
        });`;

  const newLoginValidation = `        const inputTrimmed = childId.trim();
        const isEmailInput = inputTrimmed.includes('@');
        const digitsOnly = inputTrimmed.replace(/\\D/g, '');
        const isPhoneInput = digitsOnly.length >= 10 && digitsOnly.length <= 13 && !inputTrimmed.toUpperCase().startsWith('AXC-');

        if (!isEmailInput && !isPhoneInput && !isValidFilhoLoginId(inputTrimmed)) {
          throw new Error('Informe seu E-mail, WhatsApp ou Registro (ex.: AXC-2021-B2CA).');
        }
        if (cpfPrefix.length < 6) {
          throw new Error('Digite os 6 primeiros dígitos do CPF.');
        }

        const loginPayloadId = isEmailInput || isPhoneInput
          ? inputTrimmed
          : (normalizeFilhoLoginIdInput(inputTrimmed) || inputTrimmed);

        const response = await fetch('/api/auth/filho-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: loginPayloadId,
            cpfPrefix,
          }),
        });`;

  // Atualizar a UI do campo
  const oldLoginField = `                        <div className="space-y-[5px]">
                          <label className={labelClass}>Registro</label>
                          <div className="relative">
                            <User
                              className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                              strokeWidth={1.5}
                            />
                            <input
                              type="text"
                              required
                              maxLength={14}
                              autoCapitalize="characters"
                              autoCorrect="off"
                              spellCheck={false}
                              value={childId}
                              onChange={(e) => setChildId(normalizeFilhoLoginIdInput(e.target.value))}
                              onBlur={() => setChildId((v) => normalizeFilhoLoginIdInput(v))}
                              placeholder="Ex.: AXC-2021-B2CA"
                              className={fieldShell}
                            />
                          </div>
                          <p className="text-[11px] leading-snug text-[#1b1813]/45">
                            Vem no WhatsApp da casa. Pode digitar sem hífen — o sistema formata.
                          </p>
                        </div>`;

  const newLoginField = `                        <div className="space-y-[5px]">
                          <label className={labelClass}>E-mail, WhatsApp ou Registro</label>
                          <div className="relative">
                            <User
                              className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                              strokeWidth={1.5}
                            />
                            <input
                              type="text"
                              required
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              value={childId}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val.includes('@') && val.toUpperCase().startsWith('AXC')) {
                                  setChildId(normalizeFilhoLoginIdInput(val));
                                } else {
                                  setChildId(val);
                                }
                              }}
                              onBlur={() => {
                                if (!childId.includes('@') && childId.toUpperCase().startsWith('AXC')) {
                                  setChildId((v) => normalizeFilhoLoginIdInput(v));
                                }
                              }}
                              placeholder="seuemail@gmail.com, WhatsApp ou AXC-2026-XXXX"
                              className={fieldShell}
                            />
                          </div>
                          <p className="text-[11px] leading-snug text-[#1b1813]/45">
                            Entre com seu e-mail cadastrado, seu número de WhatsApp ou o código de registro da casa.
                          </p>
                        </div>`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldLoginValidation))) {
    content = norm(content).replace(norm(oldLoginValidation), norm(newLoginValidation));
    console.log('OK: Login.tsx validação atualizada para login inteligente');
  } else {
    console.warn('WARN: oldLoginValidation não encontrado em Login.tsx');
  }

  if (norm(content).includes(norm(oldLoginField))) {
    content = norm(content).replace(norm(oldLoginField), norm(newLoginField));
    console.log('OK: Login.tsx campo de login atualizado');
  } else {
    console.warn('WARN: oldLoginField não encontrado em Login.tsx');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
