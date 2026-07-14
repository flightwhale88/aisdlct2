import {
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getChallenge, createSession, setSessionCookie } from '@/lib/auth';
import { userDB, authenticatorDB } from '@/lib/db';

const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.RP_ORIGIN || 'http://localhost:3000';

// Base64URL encoding/decoding helpers
function bufferToBase64url(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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

    // Verify registration response
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });
    } catch (error) {
      console.error('Registration verification error:', error);
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 },
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 },
      );
    }

    // Create user
    const user = userDB.create(username);

    // Store authenticator
    const credentialIdString = bufferToBase64url(
      verification.registrationInfo!.credentialID,
    );
    const publicKeyString = bufferToBase64url(
      verification.registrationInfo!.credentialPublicKey,
    );

    authenticatorDB.create({
      user_id: user.id,
      credential_id: credentialIdString,
      credential_public_key: publicKeyString,
      counter: verification.registrationInfo!.counter,
      credential_device_type: verification.registrationInfo!.credentialDeviceType || 'unknown',
      credential_backed_up: verification.registrationInfo!.credentialBackedUp ? 1 : 0,
      transports: JSON.stringify(response.response.transports || []),
    });

    // Create session
    const token = await createSession({
      userId: user.id,
      username: user.username,
    });

    await setSessionCookie(token);

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error('Register verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify registration' },
      { status: 500 },
    );
  }
}
