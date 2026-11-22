import { RootRedirect } from "./RootRedirect";

/** `/` sends people where they belong (frontend spec §2). */
export default function HomePage() {
	return <RootRedirect />;
}
