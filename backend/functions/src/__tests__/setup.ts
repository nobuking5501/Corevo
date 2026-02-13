/**
 * Jest setup file
 * Runs before all tests
 */

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
  auth: jest.fn(() => ({
    getUserByEmail: jest.fn(),
    createCustomToken: jest.fn(),
  })),
}));

// Mock Firebase Functions
jest.mock('firebase-functions/v2/https', () => ({
  onCall: jest.fn((config, handler) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string, public details?: any) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

// Set test environment variables
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
