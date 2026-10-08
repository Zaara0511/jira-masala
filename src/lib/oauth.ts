"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Client, Account, OAuthProvider } from "node-appwrite";

export async function signUpWithGithub() {
	const client = new Client()
		.setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
		.setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!);

	const account = new Account(client);

  const origin = headers().get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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

  const origin = headers().get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

	const redirectUrl = await account.createOAuth2Token(
		OAuthProvider.Google,
		`${origin}/oauth`,
		`${origin}/sign-up`,
	);

	return redirect(redirectUrl);
};
