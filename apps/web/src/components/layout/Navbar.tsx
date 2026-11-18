import { Link, useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../../hooks/useAuth';

export function Navbar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout.mutate();
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-blue-400 font-bold text-lg tracking-tight">
          HAU CEX
        </Link>
        <Link to="/markets" className="text-gray-300 hover:text-white text-sm transition-colors">
          Markets
        </Link>
        {user && (
          <>
            <Link
              to="/wallet"
              className="text-gray-300 hover:text-white text-sm transition-colors"
            >
              Wallet
            </Link>
            {user.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="text-yellow-400 hover:text-yellow-300 text-sm transition-colors"
              >
                Admin
              </Link>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-300 hover:text-white transition-colors px-3 py-1 rounded border border-gray-600 hover:border-gray-400"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
            >
              Register
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
