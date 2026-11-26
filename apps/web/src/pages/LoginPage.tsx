import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import { Input, Button, Alert } from '../components/ui';
import { parseApiError } from '../lib/utils';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login.mutateAsync({
        email,
        password,
        ...(requires2fa && totpCode.trim() ? { totpCode: totpCode.trim() } : {}),
      });
      navigate('/markets');
    } catch (err) {
      const data = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      if (
        data?.code === 'TWO_FACTOR_REQUIRED' ||
        data?.message?.toLowerCase().includes('two-factor')
      ) {
        setRequires2fa(true);
        setError('Tài khoản đang bật 2FA. Vui lòng nhập mã 6 chữ số từ Google Authenticator.');
        return;
      }
      setError(parseApiError(err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-3 group">
            <img src="/logo-icon.png" alt="HAU CEX" className="w-16 h-16 rounded-2xl shadow-xl transition-transform group-hover:scale-105" />
            <img src="/logo.png" alt="HAU CEX" className="h-7 w-auto object-contain" />
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Đăng nhập vào tài khoản</p>
        </div>

        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4"
        >
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

          <Input
            label="Email"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {requires2fa && (
            <Input
              label="Mã xác thực 2FA (6 chữ số)"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={login.isPending}
            className="w-full"
          >
            Đăng nhập
          </Button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
