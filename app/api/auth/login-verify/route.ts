import {
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getChallenge, createSession, setSessionCookie } from '@/lib/auth';
import { userDB, authenticatorDB } from '@/lib/db';

const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.RP_ORIGIN || 'http://localhost:3000';

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
    const { username, response } = await request.json();

    if (!username || !response) {
      return NextResponse.json(
        { error: 'Username and response required' },
        { status: 400 },
      );
    }

    // Retrieve stored challenge
    const expectedChallenge = await getChallenge(username);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 },
      );
    }

    // Find user
    const user = userDB.findByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: 'Username or password incorrect' },
        { status: 401 },
      );
    }

    // Find authenticator by credential_id
    const credentialIdString = response.id; // response.id is already base64url encoded
    const authenticator = authenticatorDB.findByCredentialId(credentialIdString);

    if (!authenticator) {
      return NextResponse.json(
        { error: 'Authenticator not recognized' },
        { status: 401 },
      );
    }

    // Verify authentication response
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        authenticator: {
          credentialID: base64urlToBuffer(authenticator.credential_id),
          credentialPublicKey: base64urlToBuffer(
            authenticator.credential_public_key,
          ),
          counter: authenticator.counter ?? 0, // CRITICAL: Always use ?? 0
        },
      });
    } catch (error) {
      console.error('Authentication verification error:', error);
      return NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 401 },
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 401 },
      );
    }

    // Update counter
    const newCounter = verification.authenticationInfo?.newCounter ?? 0; // CRITICAL: Always use ?? 0
    authenticatorDB.updateCounter(authenticator.credential_id, newCounter);

    // Create session
    const token = await createSession({
      userId: user.id,
      username: user.username,
    });

    await setSessionCookie(token);

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error('Login verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 },
    );
  }
}
