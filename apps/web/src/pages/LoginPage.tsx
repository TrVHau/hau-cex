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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login.mutateAsync({ email, password });
      navigate('/markets');
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">HAU CEX</h1>
          <p className="text-gray-400 mt-2">Đăng nhập vào tài khoản</p>
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
