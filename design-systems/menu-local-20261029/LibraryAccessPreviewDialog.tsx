import { Eye } from 'lucide-react';
import { WorkflowDialog } from './WorkflowUI';
import './libraryAccessPreview.css';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Array<{ id: string; name: string }>;
  selectedMember: string;
  onSelectMember: (id: string) => void;
  onPreview: (id: string) => void;
};

export default function LibraryAccessPreviewDialog({ open, onOpenChange, members, selectedMember, onSelectMember, onPreview }: Props) {
  const selected = members.some(member => member.id === selectedMember);
  return <WorkflowDialog open={open} onOpenChange={onOpenChange}
    title="Testar acesso de um filho"
    description="Confira quais materiais cada filho pode acessar na biblioteca."
    contentClassName="lb-access-preview-dialog">
    <form onSubmit={event => { event.preventDefault(); if (selected) onPreview(selectedMember); }}>
      <label className="wf-field lb-preview-field">
        Escolha um filho
        <select value={selectedMember} onChange={event => onSelectMember(event.target.value)} disabled={!members.length}>
          <option value="">Selecione na lista</option>
          {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </label>
      <p className="lb-access-preview-note">
        {members.length ? 'A prévia mostra o acervo da casa e os materiais privados compartilhados com o filho escolhido.' : 'Nenhum filho disponível para visualizar. Cadastre um membro da casa para testar o acesso.'}
      </p>
      <div className="lb-access-preview-actions">
        <button type="button" className="wf-button secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
        <button type="submit" className="wf-button" disabled={!selected}><Eye size={17}/>Ver biblioteca do filho</button>
      </div>
    </form>
  </WorkflowDialog>;
}
