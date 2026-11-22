import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Inter } from "next/font/google";

import { THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
	title: "Safka",
	description: "Creator sponsorships, from brief to delivery."
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		// The head script sets `dark` before paint, so the class differs from
		// the server render on purpose.
		<html lang="en" className={inter.variable} suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
			</head>
			<body className="min-h-dvh bg-bg font-sans text-fg antialiased">
				{children}
			</body>
		</html>
	);
}
