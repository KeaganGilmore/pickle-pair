import { z } from 'zod';

export const GenderSchema = z.enum(['M', 'F', 'Other', 'Unspecified']);
export type Gender = z.infer<typeof GenderSchema>;

export const TournamentFormatSchema = z.enum([
  'round_robin',
  'single_elim',
  'americano',
  'king_of_court',
]);
export type TournamentFormat = z.infer<typeof TournamentFormatSchema>;

export const TournamentModeSchema = z.enum(['singles', 'doubles']);
export type TournamentMode = z.infer<typeof TournamentModeSchema>;

export const PartnerModeSchema = z.enum(['random', 'fixed', 'rotating']);
export type PartnerMode = z.infer<typeof PartnerModeSchema>;

export const MatchStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'void',
  'bye',
  'forfeit',
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const TournamentStatusSchema = z.enum(['setup', 'live', 'paused', 'done']);
export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;

export const SkillRatingSchema = z
  .number()
  .min(2)
  .max(5)
  .refine((n) => Number.isInteger(n * 2), 'Must be in 0.5 steps');

export const PlayerSchema = z.object({
  id: z.string(),
  tournament_id: z.string(),
  name: z.string().min(1).max(60),
  gender: GenderSchema.default('Unspecified'),
  skill: z.number().nullable().optional(),
  withdrawn: z.boolean().default(false),
  withdrawn_at: z.string().nullable().optional(),
  fixed_partner_id: z.string().nullable().optional(),
  seed: z.number().int().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const TournamentSchema = z.object({
  id: z.string(),
  token: z.string(), // public viewing token (short)
  edit_token: z.string(), // organizer edit token
  name: z.string().min(1).max(80),
  mode: TournamentModeSchema,
  format: TournamentFormatSchema,
  partner_mode: PartnerModeSchema.nullable().optional(),
  mixed: z.boolean().default(false),
  courts: z.number().int().min(1).max(32).default(2),
  points_to_win: z.number().int().min(1).max(99).default(11),
  win_by_two: z.boolean().default(true),
  time_cap_minutes: z.number().int().nullable().optional(),
  status: TournamentStatusSchema.default('setup'),
  current_round: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Tournament = z.infer<typeof TournamentSchema>;

export const TeamSchema = z.object({
  // player ids — length 1 (singles) or 2 (doubles)
  players: z.array(z.string()).min(1).max(2),
});
export type Team = z.infer<typeof TeamSchema>;

export const MatchSchema = z.object({
  id: z.string(),
  tournament_id: z.string(),
  round: z.number().int(),
  court: z.number().int().nullable().optional(),
  team_a: z.array(z.string()), // player ids
  team_b: z.array(z.string()),
  score_a: z.number().int().default(0),
  score_b: z.number().int().default(0),
  status: MatchStatusSchema.default('scheduled'),
  // bracket metadata (for single-elim)
  bracket_slot: z.string().nullable().optional(), // e.g., "QF1", "SF2", "F"
  winner_feeds_match: z.string().nullable().optional(),
  loser_feeds_match: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Match = z.infer<typeof MatchSchema>;

export const AuditActionSchema = z.enum([
  'tournament_created',
  'tournament_updated',
  'tournament_deleted',
  'player_added',
  'player_updated',
  'player_withdrawn',
  'player_substituted',
  'round_generated',
  'round_repaired',
  'match_updated',
  'score_updated',
  'match_completed',
  'match_voided',
  'match_forfeited',
  'tournament_paused',
  'tournament_resumed',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
  tournament_id: z.string(),
  action: AuditActionSchema,
  target_id: z.string().nullable().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
  created_at: z.string(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export type TeamDisplay = {
  teamId: string;
  playerIds: string[];
  label: string;
};

export type Standing = {
  playerId: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  withdrawn: boolean;
};

export type PendingMutation = {
  id: string;
  entity: 'tournament' | 'player' | 'match' | 'audit';
  op: 'upsert' | 'delete';
  tournament_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  tries: number;
  last_error?: string;
};
