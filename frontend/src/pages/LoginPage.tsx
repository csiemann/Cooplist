import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = mode === 'login'
        ? await login(email, password)
        : await register(email, password, name);

      const { token, user } = response.data;
      setAuth(user, token);
      showSuccess(`Bem-vindo, ${user.name}!`);
      navigate('/');
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Erro ao autenticar');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #07111f 0%, #15263d 100%)', color: 'white', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#0f1b2d', border: '1px solid #223449', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
        <p style={{ marginBottom: '20px', color: '#8ea3b8', fontSize: '14px' }}>Conecte-se ao Cooplist para controlar suas playlists colaborativas.</p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => setMode('login')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: mode === 'login' ? '1px solid #1db954' : '1px solid #223449', background: mode === 'login' ? '#16253b' : '#111c2b', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Login</button>
          <button onClick={() => setMode('register')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: mode === 'register' ? '1px solid #1db954' : '1px solid #223449', background: mode === 'register' ? '#16253b' : '#111c2b', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Registrar</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
          {mode === 'register' && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" style={inputStyle} required />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} required />
          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" style={{ ...inputStyle, width: '100%', paddingRight: '44px' }} required />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#63d3ff', cursor: 'pointer', fontSize: '13px' }}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <button type="submit" style={{ padding: '12px', borderRadius: '10px', border: 'none', background: '#1db954', color: 'black', fontWeight: 700, cursor: 'pointer', marginTop: '6px' }}>{mode === 'login' ? 'Entrar' : 'Registrar'}</button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid #223449',
  background: '#111c2b',
  color: 'white',
};
