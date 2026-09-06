import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Reply, 
  Trash2, 
  MessageSquare, 
  Loader2,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Comment {
  id: string;
  arquivo_id: string;
  user_id: string;
  tenant_id: string;
  texto: string;
  parent_id: string | null;
  created_at: string;
  user_profile?: {
    full_name: string;
    avatar_url: string;
    role: string;
  };
  replies?: Comment[];
}

interface CommentSectionProps {
  materialId: string;
  user: any;
  userRole: string;
  tenantId: string;
  isAdminGlobal?: boolean;
}

export default function CommentSection({ materialId, user, userRole, tenantId, isAdminGlobal }: CommentSectionProps) {
  const isAdmin = userRole !== 'filho' || isAdminGlobal;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    try {
      setLoading(true);
      // Fetch comments and join with profiles (assuming profiles table exists)
      const { data, error } = await supabase
        .from('biblioteca_comentarios')
        .select(`
          *,
          user_profile:profiles(full_name, avatar_url, role)
        `)
        .eq('arquivo_id', materialId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Organize comments into a tree structure (one level deep for simplicity)
      const rootComments = data?.filter(c => !c.parent_id) || [];
      const replies = data?.filter(c => c.parent_id) || [];

      const commentTree = rootComments.map(root => ({
        ...root,
        replies: replies.filter(reply => reply.parent_id === root.id)
      }));

      setComments(commentTree);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [materialId]);

  const handleSubmit = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    const text = parentId ? (e.target as any).replyText.value : newComment;
    if (!text.trim()) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('biblioteca_comentarios')
        .insert([{
          arquivo_id: materialId,
          user_id: user.id,
          tenant_id: tenantId,
          texto: text,
          parent_id: parentId
        }]);

      if (error) throw error;

      // Notify Zelador if it's a new comment from a Filho
      if (userRole === 'filho' && !parentId) {
        await authFetch('/api/v1/library/comment-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            mensagem: `Nova dúvida na Biblioteca: ${text.substring(0, 50)}...`,
            link: 'library',
          }),
        });
      }

      setNewComment('');
      setReplyingTo(null);
      fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Erro ao enviar comentário.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este comentário?')) return;

    try {
      const { error } = await supabase
        .from('biblioteca_comentarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment, isReply?: boolean }) => (
    <motion.div 
      initial={{ opacity: 0, x: isReply ? 20 : 0 }}
      animate={{ opacity: 1, x: isReply ? 20 : 0 }}
      className={cn(
        "flex gap-4 rounded-2xl border border-[#DDD5C9] bg-white p-4 text-[#211D17] shadow-sm transition-all",
        isReply ? "ml-4 border-l-2 border-l-primary/50 bg-[#FBF8F1]" : ""
      )}
    >
      <div className="flex-shrink-0">
        {comment.user_profile?.avatar_url ? (
          <img 
            src={comment.user_profile.avatar_url} 
            alt={comment.user_profile.full_name}
            className="w-10 h-10 rounded-full border border-primary/20 object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-primary">
              {comment.user_profile?.full_name || 'Usuário'}
            </span>
            {(comment.user_profile?.role === 'admin' || comment.user_profile?.role === 'zelador' || comment.user_profile?.role === 'lider') && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-primary text-background rounded-full text-[8px] font-black uppercase tracking-widest">
                <ShieldCheck className="w-2 h-2" />
                Liderança
              </span>
            )}
            <span className="text-[10px] font-bold text-[#756E63]">
              {new Date(comment.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {!isReply && (
              <button 
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="p-2 text-[#756E63] transition-colors hover:text-[#8C6A00]"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
            {(isAdmin || user.id === comment.user_id) && (
              <button 
                onClick={() => handleDelete(comment.id)}
                className="p-2 text-[#756E63] transition-colors hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <p className="text-sm leading-relaxed text-[#39342D]">
          {comment.texto}
        </p>

        {replyingTo === comment.id && (
          <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-4 flex gap-2">
            <input 
              name="replyText"
              autoFocus
              placeholder="Sua resposta..."
              className="flex-1 rounded-xl border border-[#CFC5B7] bg-white px-4 py-2 text-sm text-[#211D17] outline-none transition-all placeholder:text-[#81796E] focus:border-primary"
            />
            <button 
              type="submit"
              disabled={submitting}
              className="bg-primary text-background p-2 rounded-xl hover:scale-105 transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4">
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="mt-12 space-y-8">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-black tracking-tight text-[#211D17]">Dúvidas e <span className="text-[#B38300]">Esclarecimentos</span></h2>
      </div>

      {/* New Comment Input */}
      <form onSubmit={(e) => handleSubmit(e)} className="relative group">
        <textarea 
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Tire sua dúvida sobre este fundamento..."
          className="min-h-[120px] w-full resize-none rounded-3xl border border-[#2D333B] bg-[#111418] p-6 pr-32 font-medium text-[#F8FAFC] shadow-sm transition-all placeholder:text-[#AAB2BD] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button 
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="absolute bottom-4 right-4 bg-primary text-background px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : comments.length > 0 ? (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-[#AFA697] bg-white/70 px-5 py-10 text-center shadow-sm">
            <p className="font-bold text-[#5B554C]">Nenhuma dúvida registrada ainda. Seja o primeiro a perguntar!</p>
          </div>
        )}
      </div>
    </div>
  );
}
