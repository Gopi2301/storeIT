'use server';
import { createAdminClient } from '@/lib/appwrite';
import { appwriteConfig } from '@/lib/appwrite/config';
import { ID, Query } from 'node-appwrite';
import { parseStringify } from '@/lib/utils';
import { cookies } from 'next/headers';

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

export const sentEmailOTP = async ({ email }: { email: string }) => {
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
  } catch (error) {
    handleError(error, 'Failed to verify OTP');
  }
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
  const accountId = await sentEmailOTP({ email });
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
        avatar:
          'https://th.bing.com/th/id/OIP.ggX8e6U3YzyhPvp8qGZtQwHaHa?w=196&h=196&c=7&r=0&o=5&pid=1.7',
        accountId,
      },
    );
    return parseStringify({ accountId });
  }
};
