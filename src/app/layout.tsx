import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Geist } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
	title: "Safka",
	description: "Creator sponsorships, from brief to delivery."
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={geistSans.variable}>
			<body className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased">
				{children}
			</body>
		</html>
	);
}
