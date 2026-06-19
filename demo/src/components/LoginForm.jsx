/**
 * LoginForm — simple username/password form to get a JWT.
 *
 * Posts credentials to /auth/login and returns the access_token.
 * For development with the simulator, you can also use a "viewer mode"
 * that mints a token client-side (requires the server to accept it).
 */
import { useState } from 'react';

/**
 * @param {{ onLogin: (token: string) => void }} props
 */
export function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Login failed (${response.status})`);
      }

      const data = await response.json();
      onLogin(data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    // Quick login with a seeded test user
    setUsername('apexkai');
    setPassword('testpass123');
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'apexkai', password: 'testpass123' }),
      });

      if (!response.ok) {
        throw new Error('Quick login failed — have you run the seed script?');
      }

      const data = await response.json();
      onLogin(data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>SlipStream Viewer</h2>
        <p>Log in to connect to the spatial stream</p>

        {error && <div className="error">{error}</div>}

        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="apexkai"
          autoComplete="username"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="testpass123"
          autoComplete="current-password"
        />

        <button type="submit" disabled={loading || !username || !password}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>

        <div className="hint">
          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#6366f1',
              cursor: 'pointer',
              fontSize: '12px',
              textDecoration: 'underline',
              width: 'auto',
              padding: 0,
            }}
          >
            Quick login as apexkai (test user)
          </button>
        </div>
      </form>
    </div>
  );
}
