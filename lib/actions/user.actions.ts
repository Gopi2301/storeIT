'use server';
import { createAdminClient, createSessionClient } from '@/lib/appwrite';
import { appwriteConfig } from '@/lib/appwrite/config';
import { ID, Query } from 'node-appwrite';
import { parseStringify } from '@/lib/utils';
import { cookies } from 'next/headers';
import { avatarPlaceHolder } from '@/constants';

// import {attribute} from "postcss-selector-parser";

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();
  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.userscollectionId,
    [Query.equal('email', [email])],
  );
  return result.total > 0 ? result.documents[0] : null;
};
const handleError = (error: any, message: string) => {
  console.log(error.message);
  throw error;
};

export const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();
  try {
    const session = await account.createEmailToken(ID.unique(), email);
    return session.userId;
  } catch (error) {
    handleError(error, 'Failed to send email OTP');
  }
};

export const verifySecret = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createSession(accountId, password);
    (await cookies()).set('appwrite-session', session.secret, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
    });
    return parseStringify({ sessionId: session.$id });
  } catch (error) {
    handleError(error, 'Failed to verify OTP');
  }
};

export const getCurrentUser = async () => {
  const { databases, account } = await createSessionClient();
  const result = await account.get();
  const user = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.userscollectionId,
    [Query.equal('accountId', result.$id)],
  );
  if (user.total <= 0) return null;
  return parseStringify(user.documents[0]);
};
// Create Account
export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  const existingUser = await getUserByEmail(email);
  const accountId = await sendEmailOTP({ email });
  if (!accountId) throw new Error('Failed to send an OTP');
  if (!existingUser) {
    const { databases } = await createAdminClient();
    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userscollectionId,
      ID.unique(),
      {
        fullName,
        email,
        avatar: avatarPlaceHolder,
        accountId,
      },
    );
    return parseStringify({ accountId });
  }
};
export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);

    // User exists, send OTP
    if (existingUser) {
      await sendEmailOTP({ email });
      return parseStringify({ accountId: existingUser.accountId });
    }

    return parseStringify({ accountId: null, error: 'User not found' });
  } catch (error) {
    handleError(error, 'Failed to sign in user');
  }
};
