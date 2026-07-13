import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { acceptInvite } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleAccept = async () => {
    if (!token) {
      setStatus('error');
      setMessage('Token de convite inválido.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      await acceptInvite(token);
      setStatus('success');
      setMessage('Convite aceito com sucesso! Você já pode acessar a playlist.');
      setTimeout(() => navigate('/'), 1200);
    } catch (error: any) {
      setStatus('error');
      setMessage(error?.response?.data?.error || 'Não foi possível aceitar o convite.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #07111f 0%, #15263d 100%)', color: 'white' }}>
      <div style={{ width: '100%', maxWidth: '520px', background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Aceitar convite</h2>
        <p style={{ marginBottom: '24px', color: '#8ea3b8' }}>
          {user ? `Olá, ${user.name}!` : 'Faça login para aceitar o convite e entrar na playlist.'}
        </p>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: '#111c2b', border: '1px solid #223449', borderRadius: '14px', padding: '18px' }}>
            <p style={{ margin: 0, color: '#cbd8ee' }}>Clique no botão abaixo para confirmar sua participação na playlist vinculada a este convite.</p>
          </div>

          {message && (
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: status === 'error' ? '#631b1b' : '#1b472b', color: 'white' }}>
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={handleAccept}
            disabled={status === 'loading'}
            style={{ padding: '14px', borderRadius: '12px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer' }}
          >
            {status === 'loading' ? 'Aceitando...' : 'Aceitar convite'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ padding: '14px', borderRadius: '12px', border: '1px solid #223449', background: '#111c2b', color: 'white', cursor: 'pointer' }}
          >
            Voltar ao dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
