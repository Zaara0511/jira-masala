"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Client, Account, OAuthProvider } from "node-appwrite";

function getOAuthOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      const headerOrigin = headers().get("origin");
      if (headerOrigin) {
        return headerOrigin.replace(/\/+$/, "");
      }
    } catch {
      // Fall through to localhost fallback
    }
    return "http://localhost:3000";
  }

  return "https://jira-masala.onrender.com";
}

export async function signUpWithGithub() {
	const client = new Client()
		.setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
		.setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!);

	const account = new Account(client);

  const origin = getOAuthOrigin();

	const redirectUrl = await account.createOAuth2Token(
		OAuthProvider.Github,
		`${origin}/oauth`,
		`${origin}/sign-up`,
	);

	return redirect(redirectUrl);
};

export async function signUpWithGoogle() {
	const client = new Client()
		.setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
		.setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!);

	const account = new Account(client);

  const origin = getOAuthOrigin();

	const redirectUrl = await account.createOAuth2Token(
		OAuthProvider.Google,
		`${origin}/oauth`,
		`${origin}/sign-up`,
	);

	return redirect(redirectUrl);
};
