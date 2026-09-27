import { z } from "zod";
import { inNycArea, StopSchema } from "../bridge/index";
import { isAvatar, type Avatar } from "../core/avatars";

export const TRIP_ID = /^[A-Za-z0-9_-]{10}$/;

const Name = z.string().trim().min(1, "Add your name.").max(30, "Keep your name under 30 characters.");
const MemberId = z.string().regex(/^[A-Za-z0-9_-]{8,40}$/, "Join the trip first.");
/** Who the browser thinks it is. A signed-in request is its account whatever this says (see member.ts). */
const Claim = MemberId.optional();
const AvatarSchema = z.custom<Avatar>(isAvatar, { message: "Pick an emoji and a color." });
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

export const CreateTripBody = z
  .object({ name: Name, avatar: AvatarSchema, code: z.string().min(1).max(4000).optional(), date: DateString.optional() })
  .refine((b) => b.code || b.date, { message: "Pick a date." });
export const JoinBody = z.object({ name: Name, avatar: AvatarSchema });
export const CandidateBody = z.object({
  memberId: Claim,
  stop: StopSchema.refine(inNycArea, { message: "That place isn't in New York City." }),
  note: z.string().trim().max(140, "Keep the why under 140 characters.").nullish(),
  creditTo: MemberId.nullish(),
});
export const AskBody = z.object({ memberId: Claim, text: z.string().trim().min(3, "Tell Roam AI a little more.").max(600) });
export const IdeaSuggestBody = z.object({ memberId: Claim, ideaId: z.string().regex(/^[A-Za-z0-9_-]{4,16}$/) });
export const VoteBody = z.object({ memberId: Claim, stopKey: z.string().min(1).max(80), on: z.boolean() });
export const RemoveBody = z.object({ memberId: Claim, stopKey: z.string().min(1).max(80) });
const PointSchema = z.object({ lat: z.number(), lon: z.number() }).refine(inNycArea, { message: "Pick a starting point in New York City." });
export const StartBody = z.object({ memberId: Claim, point: PointSchema.nullable() });
const IdeaId = z.string().regex(/^[A-Za-z0-9_-]{4,16}$/, "That idea isn't here anymore.");
export const IdeaBody = z.object({ memberId: Claim, text: z.string().trim().min(1, "Write something first.").max(280, "Keep it under 280 characters.") });
export const IdeaVoteBody = z.object({ memberId: Claim, ideaId: IdeaId, on: z.boolean() });
export const IdeaLinkBody = z.object({ memberId: Claim, ideaId: IdeaId, placeKey: z.string().min(1).max(80) });
const Free = z
  .object({ from: z.number().int().min(5 * 60), to: z.number().int().max(27 * 60) })
  .refine((w) => w.to - w.from >= 60, { message: "Pick at least an hour." });
export const FreeBody = z.object({ memberId: Claim, free: Free.nullable() });
export const ItineraryBody = z.object({ memberId: Claim, order: z.array(z.string().min(1).max(80)).max(30) });
export const RegenerateBody = z.object({ memberId: Claim });
export const ConfirmBody = z.object({ memberId: Claim, on: z.boolean() });
export const DeadlineBody = z.object({ memberId: Claim, at: z.number().int().nullable() });
