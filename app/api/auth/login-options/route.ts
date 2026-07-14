import {
  generateAuthenticationOptions,
} from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge, saveChallenge } from '@/lib/auth';
import { userDB, authenticatorDB } from '@/lib/db';

const RP_ID = process.env.RP_ID || 'localhost';

// Base64URL encoding/decoding helpers
function base64urlToBuffer(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    // Find user
    const user = userDB.findByUsername(username);
    if (!user) {
      // Don't leak whether username exists
      return NextResponse.json(
        { error: 'Username or password incorrect' },
        { status: 401 },
      );
    }

    // Get user's authenticators
    const authenticators = authenticatorDB.findAllByUserId(user.id);
    if (authenticators.length === 0) {
      return NextResponse.json(
        { error: 'No authenticators registered for this user' },
        { status: 401 },
      );
    }

    // Generate authentication options
    const challenge = generateChallenge();
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: authenticators.map((auth) => ({
        id: base64urlToBuffer(auth.credential_id),
        type: 'public-key' as const,
        transports: auth.transports ? JSON.parse(auth.transports) : undefined,
      })),
    });

    // Store challenge temporarily
    await saveChallenge(username, challenge);

    // Return options with our generated challenge
    return NextResponse.json({
      ...options,
      challenge, // Override with our challenge
    });
  } catch (error) {
    console.error('Login options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 },
    );
  }
}
