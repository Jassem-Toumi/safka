import type { Format } from "@/shared/contracts";
import { topicDisplayName } from "@/shared/topics";

/**
 * Deterministic, editable video angle templates (spec §4). No model call.
 * {product} = product name, {topic} = lower-case display name of the top matched topic.
 */
const TEMPLATES: Record<Format, string> = {
  COMPARISON: "Put {product} side by side with a typical setup and let viewers see and hear the difference.",
  DEMO: "Show {product} in action in a real {topic} setup, start to finish.",
  REVIEW: "Give an honest hands-on review of {product}: what stood out after a week of daily use.",
  TUTORIAL: "Walk viewers step by step through setting up {product}, with tips from your {topic} videos.",
  UNBOXING: "Unbox {product} on camera and share first impressions within the first minute.",
  STORY: "Tell the story of how {product} changed your everyday {topic} routine.",
  OTHER: "Feature {product} in your next {topic} video, in your own style.",
};

/** Sound-test creators get the spec's example angle. */
const SOUND_COMPARISON = "Let viewers hear the difference between the stock and upgraded build with {product}.";

export function suggestAngle(args: { format: Format | null; topics: string[]; productName: string }): string | null {
  if (!args.format) return null;
  const topic = args.topics[0] ? topicDisplayName(args.topics[0]).toLowerCase() : "everyday";
  const soundy = args.topics.some((t) => /sound/.test(t));
  const tpl = (args.format === "COMPARISON" || args.format === "DEMO") && soundy ? SOUND_COMPARISON : TEMPLATES[args.format];
  return tpl.replaceAll("{product}", args.productName).replaceAll("{topic}", topic);
}
