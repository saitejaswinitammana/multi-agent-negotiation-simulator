/**
 * Post-Interaction Summary Agent Generation Service
 * Milestone 4 - Member 1 Feature
 *
 * Automatically generates comprehensive post-negotiation executive summaries,
 * concession trajectory milestones, opening bid audits, and decision point narratives
 * for both Simulation Mode (AI vs AI) and Practice Mode (Human vs AI).
 */

/**
 * Format currency amounts nicely
 */
function formatCurrency(amount, currency = '₹') {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return 'N/A';
  return `${currency}${Number(amount).toLocaleString()}`;
}

/**
 * Ingests multi-round messages and offers to extract initial opening bids
 */
function extractOpeningBids(simulation) {
  const messages = simulation.messages || [];
  const offers = simulation.offers || [];
  const agents = simulation.agents || [];
  const openingBids = [];
  const seenRoles = new Set();

  // 1. Check structured offers first
  for (const offer of offers) {
    if (offer.agent_role && !seenRoles.has(offer.agent_role)) {
      seenRoles.add(offer.agent_role);
      const agent = agents.find((a) => a.role === offer.agent_role) || {};
      openingBids.push({
        agent_role: offer.agent_role,
        agent_name: agent.name || offer.agent_role,
        personality: agent.personality || 'Unknown',
        is_human: Boolean(agent.is_human || agent.personality === 'Human'),
        round_number: offer.round_number || 1,
        offer_value: offer.offer_value,
        terms: offer.terms || {},
      });
    }
  }

  // 2. Fallback to transcript messages if offers table was empty
  if (openingBids.length === 0) {
    for (const msg of messages) {
      if (
        msg.offer_value !== null &&
        msg.offer_value !== undefined &&
        msg.sender_role &&
        !seenRoles.has(msg.sender_role) &&
        msg.sender_type !== 'ORCHESTRATOR'
      ) {
        seenRoles.add(msg.sender_role);
        const agent = agents.find((a) => a.role === msg.sender_role) || {};
        openingBids.push({
          agent_role: msg.sender_role,
          agent_name: msg.sender_name || agent.name || msg.sender_role,
          personality: msg.personality || agent.personality || 'Unknown',
          is_human: Boolean(agent.is_human || agent.personality === 'Human' || msg.sender_type === 'HUMAN'),
          round_number: msg.round_number || 1,
          offer_value: msg.offer_value,
          terms: msg.terms || {},
        });
      }
    }
  }

  return openingBids;
}

/**
 * Analyzes round-by-round shifts to extract key concession milestones
 */
function extractConcessionMilestones(simulation) {
  const messages = simulation.messages || [];
  const milestones = [];
  const lastOffersByRole = {};

  for (const msg of messages) {
    if (
      msg.sender_type === 'ORCHESTRATOR' ||
      !msg.sender_role ||
      msg.offer_value === null ||
      msg.offer_value === undefined
    ) {
      continue;
    }

    const role = msg.sender_role;
    const currentVal = Number(msg.offer_value);
    const prevVal = lastOffersByRole[role];

    if (prevVal !== undefined && prevVal !== currentVal) {
      const delta = currentVal - prevVal;
      const direction = delta > 0 ? 'increased' : 'decreased';
      milestones.push({
        round: msg.round_number,
        agent_role: role,
        agent_name: msg.sender_name,
        previous_value: prevVal,
        new_value: currentVal,
        concession_amount: Math.abs(delta),
        direction,
        action: msg.action || 'COUNTER_OFFER',
        description: `${msg.sender_name} (${role}) ${direction} offer from ${prevVal} to ${currentVal} in Round ${msg.round_number}.`,
      });
    }

    lastOffersByRole[role] = currentVal;
  }

  return milestones;
}

/**
 * Identifies any compromise proposals (Orchestrator deadlock compromise or midpoint steps)
 */
function extractCompromiseProposals(simulation) {
  const compromises = [];
  const deadlockRes = simulation.deadlock_resolution;

  if (deadlockRes?.initial_compromise) {
    compromises.push({
      type: 'DEADLOCK_INITIAL_COMPROMISE',
      round: deadlockRes.initial_compromise.round || simulation.current_round,
      proposed_value: deadlockRes.initial_compromise.offer_value,
      summary: deadlockRes.initial_compromise.summary || 'Orchestrator calculated midpoint compromise.',
      terms: deadlockRes.initial_compromise.terms || {},
      status: deadlockRes.status || 'PROPOSED',
    });
  }

  if (deadlockRes?.latest_proposal && deadlockRes.latest_proposal !== deadlockRes.initial_compromise) {
    compromises.push({
      type: 'DEADLOCK_REVISED_COMPROMISE',
      round: simulation.current_round,
      proposed_value: deadlockRes.latest_proposal.offer_value,
      summary: deadlockRes.latest_proposal.summary || 'Revised compromise proposal.',
      terms: deadlockRes.latest_proposal.terms || {},
      status: deadlockRes.status || 'PROPOSED',
    });
  }

  const messages = simulation.messages || [];
  for (const msg of messages) {
    if (
      msg.sender_type === 'ORCHESTRATOR' &&
      (msg.message?.toLowerCase().includes('compromise') ||
        msg.message?.toLowerCase().includes('deadlock resolution') ||
        msg.action === 'COMPROMISE_PROPOSAL')
    ) {
      compromises.push({
        type: 'ORCHESTRATOR_MEDIATION',
        round: msg.round_number,
        proposed_value: msg.offer_value,
        summary: msg.message,
      });
    }
  }

  return compromises;
}

/**
 * Generates executive narrative and analysis for Simulation Mode (AI vs AI)
 */
function generateSimulationModeNarrative(simulation, openingBids, milestones, compromises) {
  const scenarioTitle = simulation.scenario_title || simulation.scenario_id || 'Commercial Negotiation';
  const rounds = simulation.current_round || 1;
  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const agents = simulation.agents || [];
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);

  const agent1 = agents[0] || { name: 'Agent 1', role: 'Buyer', personality: 'Collaborative' };
  const agent2 = agents[1] || { name: 'Agent 2', role: 'Seller', personality: 'Aggressive' };

  let narrative = '';

  // Opening paragraph: Setup & Opening Stances
  narrative += `In this ${scenarioTitle} session, ${agent1.name} (${agent1.role}, ${agent1.personality}) and ${agent2.name} (${agent2.role}, ${agent2.personality}) engaged in a ${rounds}-round autonomous negotiation. `;

  if (openingBids.length >= 2) {
    narrative += `The interaction opened with ${openingBids[0].agent_name} anchoring at ${formatCurrency(openingBids[0].offer_value)}, while ${openingBids[1].agent_name} set an opening position at ${formatCurrency(openingBids[1].offer_value)}. `;
  }

  // Middle paragraph: Concessions & Dynamic Trajectory
  if (milestones.length > 0) {
    narrative += `Across the rounds, both agents traded concessions across ${milestones.length} major turning points. `;
    const majorConcessions = milestones.slice(0, 3).map((m) => m.description).join(' ');
    narrative += `${majorConcessions} `;
  } else {
    narrative += `Both agents maintained firm positioning with restrained concession curves during initial rounds. `;
  }

  // Deadlock / Compromise check
  if (compromises.length > 0) {
    narrative += `As the negotiation reached an impasse, the Orchestrator mediation engine intervened with a compromise proposal to resolve the dispute. `;
  }

  // Closing paragraph: Resolution or Impasse
  if (isAgreement) {
    const finalVal = agreement?.final_value || simulation.agreement_final_value || 'settled terms';
    narrative += `The session successfully converged on an agreement in Round ${rounds} at ${formatCurrency(finalVal)}, achieving mutual satisfaction within the overlapping Zone of Possible Agreement (ZOPA).`;
  } else {
    const reason = simulation.deadlock_reason || simulation.deadlock_resolution?.reason || 'reservation thresholds could not be reconciled';
    narrative += `The negotiation concluded in a deadlock after ${rounds} rounds without reaching mutual consensus. Primary deadlock trigger: ${reason}.`;
  }

  return narrative;
}

/**
 * Generates human user bargaining trajectory, pivotal decision points, and final terms for Practice Mode
 */
function generatePracticeModeNarrative(simulation, openingBids, milestones, compromises) {
  const scenarioTitle = simulation.scenario_title || simulation.scenario_id || 'Practice Negotiation';
  const rounds = simulation.current_round || 1;
  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const agents = simulation.agents || [];
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);

  const humanAgent = agents.find((a) => a.is_human || a.personality === 'Human') || agents[0] || {
    name: 'User',
    role: 'Human Participant',
  };
  const aiCounterpart = agents.find((a) => a !== humanAgent) || agents[1] || {
    name: 'AI Counterpart',
    role: 'Opponent',
    personality: 'Collaborative',
  };

  const humanOffers = (simulation.messages || []).filter(
    (m) => m.sender_type === 'HUMAN' || m.sender_role === humanAgent.role
  );
  const humanMilestones = milestones.filter((m) => m.agent_role === humanAgent.role);

  // Assess user's bargaining style
  let styleAssessment = 'Balanced and Pragmatic';
  if (humanMilestones.length === 0) {
    styleAssessment = 'Extremely Firm / Anchor-Heavy';
  } else if (humanMilestones.length >= 3) {
    styleAssessment = 'Adaptive and Concession-Oriented';
  }

  let narrative = `In this Practice Mode session on ${scenarioTitle}, the human participant (${humanAgent.name}) negotiated against ${aiCounterpart.name} (${aiCounterpart.role}, ${aiCounterpart.personality}) over ${rounds} rounds. `;

  if (openingBids.length > 0) {
    const humanOpening = openingBids.find((b) => b.agent_role === humanAgent.role);
    if (humanOpening) {
      narrative += `You established an initial anchor at ${formatCurrency(humanOpening.offer_value)}. `;
    }
  }

  narrative += `Throughout the session, your bargaining pattern displayed a ${styleAssessment} strategy. `;

  if (humanMilestones.length > 0) {
    narrative += `You executed ${humanMilestones.length} deliberate offer adjustments in response to AI countermoves. `;
  } else {
    narrative += `You held firm to your opening numbers, requiring the AI agent to make the majority of the concessions. `;
  }

  if (isAgreement) {
    const finalVal = agreement?.final_value || 'agreed terms';
    narrative += `The negotiation concluded successfully with an agreement reached at ${formatCurrency(finalVal)} in Round ${rounds}.`;
  } else {
    narrative += `The session ended without an agreement in Round ${rounds}, reaching an impasse due to gap resistance.`;
  }

  // Pivotal Decision Points
  const pivotalPoints = [];
  if (openingBids.length > 0) {
    const hOpen = openingBids.find((b) => b.agent_role === humanAgent.role);
    if (hOpen) {
      pivotalPoints.push({
        round: 1,
        title: 'Opening Anchor Placement',
        impact: `Established baseline expectations at ${formatCurrency(hOpen.offer_value)}.`,
      });
    }
  }

  if (humanMilestones.length > 0) {
    const biggestConcession = [...humanMilestones].sort((a, b) => b.concession_amount - a.concession_amount)[0];
    pivotalPoints.push({
      round: biggestConcession.round,
      title: 'Pivotal Concession Move',
      impact: `Adjusted position by ${formatCurrency(biggestConcession.concession_amount)} to narrow the negotiation gap.`,
    });
  }

  if (compromises.length > 0) {
    pivotalPoints.push({
      round: compromises[0].round,
      title: 'Mediation / Compromise Evaluation',
      impact: 'Encountered mediation terms to navigate deadlock resistance.',
    });
  }

  pivotalPoints.push({
    round: rounds,
    title: isAgreement ? 'Mutual Settlement Closure' : 'Session Impasse Termination',
    impact: isAgreement
      ? `Finalized agreed deal terms at ${formatCurrency(agreement?.final_value)}.`
      : 'Concluded session with unresolved reservation gaps.',
  });

  return {
    narrative,
    style_assessment: styleAssessment,
    human_total_offers: humanOffers.length,
    pivotal_decision_points: pivotalPoints,
  };
}

/**
 * Main Entry Point: Generates complete post-interaction summary envelope
 */
function generatePostInteractionSummary(simulation) {
  if (!simulation) {
    throw new Error('Simulation object is required for post-interaction summary generation.');
  }

  const agents = simulation.agents || [];
  const isPracticeMode = Boolean(
    simulation.is_practice ||
      simulation.mode === 'practice' ||
      agents.some((a) => a.is_human === true || a.personality === 'Human')
  );

  const openingBids = extractOpeningBids(simulation);
  const concessionMilestones = extractConcessionMilestones(simulation);
  const compromiseProposals = extractCompromiseProposals(simulation);

  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);

  let executiveNarrative = '';
  let practiceInsights = null;

  if (isPracticeMode) {
    const practiceResult = generatePracticeModeNarrative(
      simulation,
      openingBids,
      concessionMilestones,
      compromiseProposals
    );
    executiveNarrative = practiceResult.narrative;
    practiceInsights = {
      style_assessment: practiceResult.style_assessment,
      human_total_offers: practiceResult.human_total_offers,
      pivotal_decision_points: practiceResult.pivotal_decision_points,
    };
  } else {
    executiveNarrative = generateSimulationModeNarrative(
      simulation,
      openingBids,
      concessionMilestones,
      compromiseProposals
    );
  }

  const summary = {
    simulation_id: simulation.id,
    scenario_id: simulation.scenario_id,
    scenario_title: simulation.scenario_title,
    mode: isPracticeMode ? 'Practice Mode (Human vs AI)' : 'Simulation Mode (AI vs AI)',
    is_practice: isPracticeMode,
    outcome: isAgreement ? 'AGREEMENT_REACHED' : status === 'DEADLOCK' ? 'DEADLOCK' : 'CONCLUDED',
    final_round: simulation.current_round || 1,
    max_rounds: simulation.max_rounds || 10,
    final_terms: isAgreement
      ? {
          final_value: agreement?.final_value || simulation.agreement_final_value,
          terms: agreement?.terms || {},
          status: 'SETTLED',
        }
      : {
          final_gap: simulation.current_gap || 0,
          deadlock_reason: simulation.deadlock_reason || simulation.deadlock_resolution?.reason || 'Impasse reached',
          status: 'UNRESOLVED',
        },
    opening_bids: openingBids,
    concession_milestones: concessionMilestones,
    compromise_proposals: compromiseProposals,
    executive_narrative: executiveNarrative,
    practice_insights: practiceInsights,
    generated_at: new Date().toISOString(),
  };

  return summary;
}

module.exports = {
  generatePostInteractionSummary,
  extractOpeningBids,
  extractConcessionMilestones,
  extractCompromiseProposals,
  generateSimulationModeNarrative,
  generatePracticeModeNarrative,
};
