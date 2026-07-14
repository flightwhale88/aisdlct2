'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

export default function LoginPage(): ReactElement {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) {
      setError('Username is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Login failed');
      }

      router.push('/');
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError('Login failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at 20% 10%, #d6e5ff 0%, #f6f7fb 35%, #eef2ff 100%)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 'min(420px, 92vw)',
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 12px 40px rgba(16, 24, 40, 0.12)',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 28 }}>Welcome</h1>
        <p style={{ marginTop: 0, marginBottom: 16, color: '#5c6170' }}>
          Dev login for PRP 01. WebAuthn will replace this in PRP 11.
        </p>
        <label htmlFor="username" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="e.g. issuser"
          style={{
            width: '100%',
            border: '1px solid #d0d5dd',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 12,
          }}
        />
        {error ? <p style={{ color: '#b42318', marginTop: 0 }}>{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 10,
            padding: '10px 12px',
            background: '#1d4ed8',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isSubmitting ? 0.8 : 1,
          }}
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </main>
  );
}
