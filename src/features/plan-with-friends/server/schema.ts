import { z } from "zod";
import { inNycArea } from "../bridge/index";
import { StopSchema } from "../bridge/index";

export const TRIP_ID = /^[A-Za-z0-9_-]{10}$/;

const Name = z.string().trim().min(1, "Add your name.").max(30, "Keep your name under 30 characters.");
const MemberId = z.string().regex(/^[A-Za-z0-9_-]{8,20}$/, "Join the trip first.");

export const CreateTripBody = z.object({ name: Name, code: z.string().min(1).max(4000) });
export const JoinBody = z.object({ name: Name });
export const CandidateBody = z.object({
  memberId: MemberId,
  stop: StopSchema.refine(inNycArea, { message: "That place isn't in New York City." }),
});
export const VoteBody = z.object({ memberId: MemberId, stopKey: z.string().min(1).max(80), on: z.boolean() });
export const LockBody = z.object({ organizerKey: z.string().min(16).max(64) });
