import { notifyUser } from './notificationService.js';
import { recordActivity } from './activityService.js';
import logger from '../utils/logger.js';

const MENTION_REGEX = /@([a-zA-Z0-9_\-.\s]{2,50}?)(?=[\s.,!?;:]|$)/g;

const normalizeName = (name) => (name || '').toLowerCase().trim();

const extractMentionCandidates = (content) => {
  if (!content) return [];
  const matches = [...content.matchAll(MENTION_REGEX)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
};

const resolveMentions = (candidates, members) => {
  if (!candidates.length || !members?.length) return [];

  const normalized = members.map((m) => ({
    _id: m._id,
    name: m.name,
    email: m.email,
    normalized: normalizeName(m.name),
  }));

  const resolved = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const cand = normalizeName(candidate);
    if (!cand) continue;

    let match = normalized.find((m) => m.normalized === cand);
    if (!match) {
      match = normalized.find((m) => m.normalized.includes(cand) || cand.includes(m.normalized));
    }

    if (match && !seen.has(String(match._id))) {
      seen.add(String(match._id));
      resolved.push(match);
    }
  }

  return resolved;
};

const parseMentions = (content, members) => {
  const candidates = extractMentionCandidates(content);
  return resolveMentions(candidates, members);
};

const notifyMentions = async ({ content, members, actor, project, task }) => {
  const mentioned = parseMentions(content, members);

  if (mentioned.length === 0) return [];

  const results = await Promise.allSettled(
    mentioned.map((m) => {
      if (String(m._id) === String(actor._id)) return null;
      return notifyUser({
        recipient: m._id,
        sender: actor._id,
        type: 'TASK_COMMENT',
        message: `${actor.name} mentioned you in a comment on "${task?.title || 'a task'}"`,
        project,
        task: task?._id,
      });
    })
  );

  logger.debug(
    { count: mentioned.length, projectId: project, taskId: task?._id },
    'Mentions notified'
  );

  return mentioned.filter((m) => String(m._id) !== String(actor._id));
};

const buildMentionHtml = (content, members) => {
  if (!content) return '';
  const mentioned = parseMentions(content, members);
  if (mentioned.length === 0) return content;

  let html = content;
  for (const m of mentioned) {
    const escaped = m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`@(${escaped})`, 'g');
    html = html.replace(regex, `<span class="mention" data-user-id="${m._id}">@$1</span>`);
  }
  return html;
};

export {
  parseMentions,
  notifyMentions,
  buildMentionHtml,
  extractMentionCandidates,
  MENTION_REGEX,
};