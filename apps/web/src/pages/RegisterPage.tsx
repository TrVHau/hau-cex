import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import { Input, Button, Alert } from '../components/ui';
import { parseApiError } from '../lib/utils';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu phải ít nhất 8 ký tự');
      return;
    }

    try {
      await register.mutateAsync({ email, password });
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
          <p className="text-gray-400 mt-2">Tạo tài khoản mới</p>
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
            placeholder="Tối thiểu 8 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label="Xác nhận mật khẩu"
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={register.isPending}
            className="w-full"
          >
            Đăng ký
          </Button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
