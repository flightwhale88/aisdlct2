'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();

  // Check if already authenticated
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          router.push('/');
        }
      } catch {
        // Not authenticated, stay on login page
      }
    }
    checkAuth();
  }, [router]);

  async function handleRegister() {
    setError(null);
    setIsLoading(true);

    try {
      // Get registration options
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        setError(data.error || 'Failed to get registration options');
        setIsLoading(false);
        return;
      }

      const options = await optionsRes.json();

      // Start registration with platform authenticator
      let attestation;
      try {
        attestation = await startRegistration(options);
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setError('Registration cancelled');
        } else {
          setError('Biometric/security key registration failed: ' + err.message);
        }
        setIsLoading(false);
        return;
      }

      // Verify registration
      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: attestation }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        setError(data.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // Success - redirect to home
      router.push('/');
    } catch (err: any) {
      setError('An unexpected error occurred: ' + err.message);
      setIsLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    setIsLoading(true);

    try {
      // Get authentication options
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        setError(data.error || 'Failed to get authentication options');
        setIsLoading(false);
        return;
      }

      const options = await optionsRes.json();

      // Start authentication with platform authenticator
      let assertion;
      try {
        assertion = await startAuthentication(options);
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setError('Authentication cancelled');
        } else {
          setError('Biometric/security key authentication failed: ' + err.message);
        }
        setIsLoading(false);
        return;
      }

      // Verify authentication
      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: assertion }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        setError(data.error || 'Authentication failed');
        setIsLoading(false);
        return;
      }

      // Success - redirect to home
      router.push('/');
    } catch (err: any) {
      setError('An unexpected error occurred: ' + err.message);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Todo App</h1>
          <p className="text-gray-600">Passwordless Authentication with Passkeys</p>
        </div>

        <div className="space-y-4 mb-6">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleRegister}
              disabled={isLoading || !username}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading && isRegistering ? 'Registering...' : 'Register'}
            </button>
            <button
              onClick={handleLogin}
              disabled={isLoading || !username}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading && !isRegistering ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-gray-600">
          <p className="mb-2">
            Use your device&apos;s biometric (fingerprint, Face ID) or security key
          </p>
          <p className="text-xs text-gray-500">
            No password needed — secure and private ✓
          </p>
        </div>
      </div>
    </div>
  );
}
