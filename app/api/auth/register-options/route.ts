import {
  generateRegistrationOptions,
} from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge, saveChallenge } from '@/lib/auth';
import { userDB } from '@/lib/db';

const RP_ID = process.env.RP_ID || 'localhost';
const RP_NAME = process.env.RP_NAME || 'Todo App';
const ORIGIN = process.env.RP_ORIGIN || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    // Check if username already exists
    if (userDB.findByUsername(username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    // Generate registration options
    const challenge = generateChallenge();
    const userID = Buffer.from(username).toString('base64');
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID,
      userName: username,
      userDisplayName: username,
      attestationType: 'none',
    });

    // Store challenge temporarily
    await saveChallenge(username, challenge);

    // Return options with our generated challenge
    return NextResponse.json({
      ...options,
      challenge, // Override with our challenge
    });
  } catch (error) {
    console.error('Register options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 },
    );
  }
}
