"use client";

import { getCreatorProfile } from "@/lib/api";
import { errorMessage, useLoad } from "@/lib/useLoad";

import { ProfileEditor } from "../../../_components/ProfileEditor";
import { Alert, Loading, PageHeader } from "../../../_components/ui";

export default function CreatorOnboardingPage() {
	const profile = useLoad(() => getCreatorProfile(), "profile");

	return (
		<>
			<PageHeader
				eyebrow="Welcome"
				title="Set up your creator profile"
				description="Add your channel, let us find public sources about your work, keep what’s accurate, and publish. You land in your inbox afterwards."
			/>
			{profile.status === "loading" ? <Loading /> : null}
			{profile.status === "failed" ? <Alert>{errorMessage(profile.error)}</Alert> : null}
			{profile.data ? <ProfileEditor initial={profile.data} onboarding /> : null}
		</>
	);
}
