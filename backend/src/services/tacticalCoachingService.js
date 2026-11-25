
/**
 * Tactical Coaching Service
 * Analyses saved negotiation messages and produces evidence-based feedback.
 */

const ROLE_GUIDANCE = {
  buyer: [
    'Compare supplier offers with your budget before making concessions.',
    'Use a clear numerical opening anchor and explain its basis.',
    'Evaluate price together with service levels, delivery, and risk.',
  ],
  seller: [
    'Protect your margin before reducing the quoted price.',
    'Make smaller, justified concessions instead of large sudden reductions.',
    'Link every price concession to a reciprocal commitment.',
  ],
  candidate: [
    'Research the compensation range before stating your expectations.',
    'Negotiate salary alongside role scope, benefits, and growth opportunities.',
    'Avoid reducing your salary expectations without receiving something in return.',
  ],
  recruiter: [
    'Establish the approved compensation range before negotiating.',
    'Use the full value of the employment package when discussing an offer.',
    'Make balanced proposals that address both candidate expectations and budget.',
  ],
  general: [
    'Prepare a clear target and acceptable negotiation range.',
    'Support proposals with specific reasons and measurable terms.',
    'Make reciprocal concessions rather than giving value away unconditionally.',
  ],
};

function normalize(value) {
  return String(value || '').toLowerCase();
}

function getRoleType(role, name) {
  const value = `${normalize(role)} ${normalize(name)}`;

  if (/candidate|applicant|job seeker/.test(value)) return 'candidate';
  if (/recruiter|hiring|talent acquisition/.test(value)) return 'recruiter';
  if (/seller|vendor|supplier|sales|account executive/.test(value)) return 'seller';
  if (/buyer|procurement|purchas|client/.test(value)) return 'buyer';

  return 'general';
}

function validOffer(message) {
  const value = Number(message.offer_value);
  return message.offer_value !== null &&
    message.offer_value !== undefined &&
    message.offer_value !== '' &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : null;
}

function getParticipantKey(message) {
  return normalize(message.sender_role || message.sender_name || 'unknown');
}

function analyseParticipant(agent, messages, allMessages, status) {
  const role = agent.role || 'Negotiation participant';
  const name = agent.name || role;
  const personality = agent.personality || 'Not specified';
  const roleType = getRoleType(role, name);

  const ownMessages = messages;
  const offers = ownMessages
    .map((message) => ({
      value: validOffer(message),
      round: Number(message.round_number || 0),
      message: message.message || '',
    }))
    .filter((item) => item.value !== null);

  const strengths = [];
  const improvements = [];

  if (offers.length > 0) {
    strengths.push(
      `Made ${offers.length} measurable monetary proposal${offers.length === 1 ? '' : 's'} during the negotiation.`
    );
  }

  if (offers.length >= 2) {
    const first = offers[0].value;
    const last = offers[offers.length - 1].value;

    if (first !== last) {
      strengths.push('Adjusted the proposal during the negotiation instead of keeping the same position throughout.');
    }
  }

    // Detect personality-specific negotiation behaviour.
  if (roleType === 'seller') {
    for (let i = 1; i < offers.length; i += 1) {
      const previous = offers[i - 1].value;
      const current = offers[i].value;
      const reduction = ((previous - current) / previous) * 100;

      if (reduction >= 10) {
        if (normalize(personality).includes('aggressive')) {
          improvements.push(
            `Aggressive Seller critique: the price dropped by ${reduction.toFixed(1)}% in one concession, potentially sacrificing seller surplus. Use smaller, conditional concessions to protect your margin.`
          );
        } else {
          improvements.push(
            `Rapid margin erosion: the price dropped by ${reduction.toFixed(1)}% between consecutive offers. Consider smaller, conditional concessions.`
          );
        }
        break;
      }
    }
  }

  if (
    roleType === 'buyer' &&
    normalize(personality).includes('collaborative')
  ) {
    for (let i = 1; i < offers.length; i += 1) {
      const previous = offers[i - 1].value;
      const current = offers[i].value;
      const increase = ((current - previous) / previous) * 100;

      if (increase >= 10) {
        improvements.push(
          `Collaborative Buyer critique: the offer increased by ${increase.toFixed(1)}% in one concession, which may indicate conceding too quickly. Make smaller, evidence-based increases and seek reciprocal value.`
        );
        break;
      }
    }
  }

  // Identify messages without numerical proposals.
  const nonNumericMessages = ownMessages.filter((message) => {
    const action = normalize(message.action);
    return !validOffer(message) &&
      !['accept', 'reject'].includes(action);
  });

  if (nonNumericMessages.length > 0) {
    improvements.push(
      'Some messages did not include a measurable proposal. Where appropriate, support your position with specific numbers and terms.'
    );
  }

  // Compare opening anchors when both participants have numerical offers.
  const firstOwnOffer = offers[0]?.value;
    const ownParticipantKeys = new Set(ownMessages.map(getParticipantKey));

  const otherOffers = allMessages.filter(
    (message) =>
      !ownParticipantKeys.has(getParticipantKey(message)) &&
      validOffer(message) !== null
  );

  const counterpartFirstOffer = otherOffers.length
    ? validOffer(otherOffers[0])
    : null;

  if (
    firstOwnOffer !== undefined &&
    counterpartFirstOffer !== null &&
    roleType === 'buyer' &&
    firstOwnOffer < counterpartFirstOffer
  ) {
    strengths.push(
      'Strong opening anchoring: the initial buyer proposal was below the counterpart’s opening proposal.'
    );
  }

  if (
    firstOwnOffer !== undefined &&
    counterpartFirstOffer !== null &&
    roleType === 'seller' &&
    firstOwnOffer > counterpartFirstOffer
  ) {
    strengths.push(
      'Established a firm opening price above the counterpart’s initial proposal.'
    );
  }

  if (offers.length === 1) {
    improvements.push(
      'Only one numerical proposal was recorded. Consider using follow-up counteroffers to explore a mutually acceptable range.'
    );
  }

  if (strengths.length === 0) {
    strengths.push(
      'Participated in the negotiation. Review the transcript to identify opportunities for clearer proposals and stronger preparation.'
    );
  }

  if (improvements.length === 0) {
    improvements.push(
      'No major issue was detected by the available numerical checks. Continue using evidence-based and reciprocal negotiation proposals.'
    );
  }

  return {
    name,
    role,
    personality,
    strengths,
    areas_for_improvement: improvements,
    actionable_takeaways: ROLE_GUIDANCE[roleType] || ROLE_GUIDANCE.general,
    statistics: {
      numerical_offer_count: offers.length,
      non_numeric_message_count: nonNumericMessages.length,
    },
  };
}

function generateTacticalCoaching(simulation) {
  if (!simulation || !Array.isArray(simulation.messages)) {
    throw new Error('A valid simulation with a messages array is required.');
  }

    const messages = simulation.messages.filter((message) =>
    message &&
    ['AGENT', 'HUMAN'].includes(String(message.sender_type || '').toUpperCase())
  );

  if (messages.length === 0) {
    throw new Error('No negotiation messages are available for coaching.');
  }

  const agents = Array.isArray(simulation.agents) ? simulation.agents : [];
  const participants = agents.map((agent) => {
    const roleMessages = messages.filter((message) =>
      normalize(message.sender_role) === normalize(agent.role) ||
      normalize(message.sender_name) === normalize(agent.name)
    );

    return analyseParticipant(agent, roleMessages, messages, simulation.status);
  });

  // Include any transcript participant not represented in the agents array.
  const knownKeys = new Set(
    agents.map((agent) => normalize(agent.role || agent.name))
  );

  for (const message of messages) {
    const key = normalize(message.sender_role || message.sender_name);
    if (!key || knownKeys.has(key)) continue;

    const agent = {
      name: message.sender_name || message.sender_role || 'Participant',
      role: message.sender_role || 'Negotiation participant',
      personality: message.personality || 'Not specified',
    };

    const roleMessages = messages.filter(
      (item) => getParticipantKey(item) === key
    );

    participants.push(
      analyseParticipant(agent, roleMessages, messages, simulation.status)
    );
    knownKeys.add(key);
  }

  // Detect a candidate's pragmatic recovery through successive concessions.
  // This works whether the negotiation ends in agreement or deadlock.
  let deadlockRecovery = null;

  const humanMessages = messages.filter(
    (message) =>
      String(message.sender_type).toUpperCase() === 'HUMAN'
  );

  const firstHumanMessage = humanMessages[0];

  if (firstHumanMessage) {
    const humanAgent = agents.find(
      (agent) =>
        normalize(agent.role) === normalize(firstHumanMessage.sender_role) ||
        normalize(agent.name) === normalize(firstHumanMessage.sender_name)
    );

    const humanRoleType = getRoleType(
      humanAgent?.role || firstHumanMessage.sender_role,
      humanAgent?.name || firstHumanMessage.sender_name
    );

    const humanOffers = humanMessages
      .map(validOffer)
      .filter((value) => value !== null);

    const counterpartFirstOffer = messages.find(
      (message) =>
        String(message.sender_type).toUpperCase() === 'AGENT' &&
        validOffer(message) !== null
    );

    const counterpartValue = counterpartFirstOffer
      ? validOffer(counterpartFirstOffer)
      : null;

    let compromiseSteps = 0;

    if (counterpartValue !== null) {
      for (let i = 1; i < humanOffers.length; i += 1) {
        const previousDistance = Math.abs(
          humanOffers[i - 1] - counterpartValue
        );

        const currentDistance = Math.abs(
          humanOffers[i] - counterpartValue
        );

        if (currentDistance < previousDistance) {
          compromiseSteps += 1;
        }
      }
    }

    if (
      humanRoleType === 'candidate' &&
      humanOffers.length >= 2 &&
      compromiseSteps >= 1
    ) {
      deadlockRecovery =
        'Pragmatic deadlock recovery: the candidate made at least two numerical offers and moved closer to the recruiter’s opening proposal, demonstrating flexibility and progress toward agreement.';

      const candidate = participants.find(
        (participant) =>
          getRoleType(participant.role, participant.name) === 'candidate'
      );

      if (candidate) {
        candidate.strengths.push(deadlockRecovery);
      }
    }
  }
  const isPractice = messages.some(
    (message) => String(message.sender_type).toUpperCase() === 'HUMAN'
  );

  return {
    simulation_id: simulation.id || null,
    scenario_id: simulation.scenario_id || null,
    status: simulation.status || 'UNKNOWN',
    mode: isPractice ? 'PRACTICE' : 'SIMULATION',
    generated_at: new Date().toISOString(),
    participants,
    deadlock_recovery: deadlockRecovery,
  };
}

module.exports = { generateTacticalCoaching };
