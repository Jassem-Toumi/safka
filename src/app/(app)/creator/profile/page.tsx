"use client";

import { getCreatorProfile } from "@/lib/api";
import { errorMessage, useLoad } from "@/lib/useLoad";

import { ProfileEditor } from "../../../_components/ProfileEditor";
import { Alert, Loading, PageHeader } from "../../../_components/ui";

export default function CreatorProfilePage() {
	const profile = useLoad(() => getCreatorProfile(), "profile");

	return (
		<>
			<PageHeader eyebrow="Profile" title="Your creator profile" description="Brands see your published card. Saving creates changes you publish when ready." />
			{profile.status === "loading" ? <Loading /> : null}
			{profile.status === "failed" ? <Alert>{errorMessage(profile.error)}</Alert> : null}
			{profile.data ? <ProfileEditor initial={profile.data} onboarding={false} /> : null}
		</>
	);
}
