import React from 'react';
import { Camera, Loader2, Pencil, Phone, ShieldCheck } from 'lucide-react';
import Avatar from '../Avatar';
import './member-profile.css';

type MemberProfileHeaderProps = {
  name: string;
  role: string;
  status: string;
  orixa: string;
  registration: string;
  photo: string;
  whatsappUrl: string | null;
  isSelfView: boolean;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPhotoClick: () => void;
  onPhotoChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEdit: () => void;
};

export default function MemberProfileHeader({
  name, role, status, orixa, registration, photo, whatsappUrl, isSelfView,
  uploading, fileInputRef, onPhotoClick, onPhotoChange, onEdit,
}: MemberProfileHeaderProps) {
  const active = status.toLocaleLowerCase('pt-BR') === 'ativo';
  const portrait = <Avatar src={photo} name={name} alt={`Foto de ${name}`} shape="square" className="member-profile-avatar" />;

  return (
    <section className="member-profile-header" aria-label="Identificação do membro">
      <div className="member-profile-main">
        <div className="member-profile-identity">
          {isSelfView ? portrait : (
            <button type="button" className="member-profile-photo" onClick={onPhotoClick}
              disabled={uploading} aria-label={uploading ? 'Enviando foto' : `Alterar foto de ${name}`} aria-busy={uploading}>
              {portrait}
              <span className="member-profile-camera" aria-hidden="true">
                {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
              </span>
            </button>
          )}
          <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={onPhotoChange} />
          <div className="member-profile-name">
            <h2>{name}</h2>
            <p className="member-profile-role">{role}</p>
            <span className="member-profile-status" data-active={active}>{status} na corrente</span>
          </div>
        </div>
      </div>
      <div className="member-profile-details">
        <dl>
          <div><dt>Orixá de frente</dt><dd>{orixa || 'Não informado'}</dd></div>
          <div><dt>Registro</dt><dd className="member-profile-registration">{registration}</dd></div>
        </dl>
        <span className="member-profile-verified"><ShieldCheck aria-hidden="true" /> Cadastro verificado</span>
      </div>
      <div className="member-profile-actions">
        {whatsappUrl && (
          <a className="member-profile-action member-profile-contact" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Phone aria-hidden="true" /> WhatsApp
          </a>
        )}
        <button type="button" className="member-profile-action member-profile-edit" onClick={onEdit}>
          <Pencil aria-hidden="true" /> Editar perfil
        </button>
      </div>
    </section>
  );
}
